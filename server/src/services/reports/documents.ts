import { createHash } from 'node:crypto'
import { transaction } from '../../db/migrate.js'
import { getWorkspace, getEnrollment, listEnrollments } from '../../repositories/workspaces.js'
import { listScores } from '../../repositories/scores.js'
import { scoreStateInTransaction } from '../scoreProjection.js'
import { mutate, validateContext } from '../mutations.js'
import { audit } from '../accounts.js'
import { BusinessError } from '../errors.js'
import { buildStudentReportData, buildStudentReportTemplateText } from './reportModel.js'
import type { ReportStudentType } from './types.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'

/** 一致读取原始成绩和历史来源名单，归一化到百分制后计算报告；缺失不补零。 */
export function readStudentReport(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  studentId: string,
  props: string[],
  requestId: string,
  inTransaction = false
) {
  const action = () => {
    validateContext(database, context)
    const state = scoreStateInTransaction(database, context, workspaceId)
    const enrollment = getEnrollment(database, context.ownerId, workspaceId, studentId)
    if (enrollment.disabled || enrollment.departed)
      throw new BusinessError(409, 'STUDENT_INACTIVE', '不能生成停用或转出学生的报告')
    const columns = state.assessments
      .filter((row) => !row.disabled)
      .map((row) => ({ prop: row.prop, label: row.label }))
    const students: ReportStudentType[] = state.students
      .filter((row) => !row.disabled && !row.departed)
      .map((row) => ({ studentId: row.studentId, name: row.name }))
    const byId = new Map(students.map((row) => [row.studentId, row]))
    for (const unit of state.assessments.filter((row) => !row.disabled)) {
      for (const row of students) row[unit.prop] = null
      for (const score of state.scores.filter((row) => row.assessmentId === unit.id)) {
        const student = byId.get(score.studentId)
        if (student)
          student[unit.prop] =
            score.value === null
              ? null
              : (score.value / (unit.fullMark ?? state.workspace.scoreFullMark)) * 100
      }
    }
    const historicalScores = new Map<string, number[]>(),
      historicalRanks = new Map<string, Map<string, number>>()
    for (const reference of state.references) {
      columns.push({ prop: reference.prop, label: reference.label })
      const sourceIds = new Set(
        listEnrollments(database, context.ownerId, reference.sourceWorkspaceId)
          .filter((row) => !row.disabled)
          .map((row) => row.studentId)
      )
      historicalScores.set(
        reference.prop,
        listScores(database, context.ownerId, reference.sourceWorkspaceId)
          .filter(
            (row) =>
              row.assessmentId === reference.assessmentId &&
              sourceIds.has(row.studentId) &&
              row.value !== null
          )
          .map((row) => (row.value! / reference.fullMark) * 100)
      )
      historicalRanks.set(
        reference.prop,
        new Map(
          reference.scores
            .filter((row) => row.rank !== null)
            .map((row) => [row.studentId, row.rank!])
        )
      )
      for (const row of students) row[reference.prop] = null
      for (const score of reference.scores) {
        const row = byId.get(score.studentId)
        if (row)
          row[reference.prop] =
            score.value === null ? null : (score.value / reference.fullMark) * 100
      }
    }
    const selectedProps = props.length ? props : columns.map((row) => row.prop)
    if (selectedProps.some((prop) => !columns.some((column) => column.prop === prop)))
      throw new BusinessError(400, 'INVALID_REPORT_RANGE', '报告范围包含无效测评')
    const tags = database
      .prepare(
        "SELECT contentJson FROM business_resources WHERE ownerId=? AND workspaceId=? AND kind='tags' AND deletedAt IS NULL LIMIT 1"
      )
      .get(context.ownerId, workspaceId) as { contentJson: string } | undefined
    const values = tags
      ? (JSON.parse(tags.contentJson) as { assignments: Record<string, string[]> })
      : undefined
    const student = byId.get(studentId)!
    student.tags = { all: values?.assignments[studentId] || [] }
    const report = buildStudentReportData({
      student,
      students,
      scoreColumns: columns,
      selectedProps,
      tagCategories: [{ prop: 'all' }],
      historicalScores,
      historicalRanks,
      classLabel: `${state.workspace.className} · ${state.workspace.termName}（百分制）`
    })
    if (!report.scoreItems.some((row) => row.score !== null))
      throw new BusinessError(409, 'NO_REPORT_SCORES', '所选范围没有成绩')
    const sourceVersion = createHash('sha256').update(JSON.stringify(report)).digest('hex')
    const saved = database
      .prepare(
        'SELECT contentJson,version FROM workspace_documents WHERE ownerId=? AND workspaceId=? AND type=?'
      )
      .get(context.ownerId, workspaceId, `student-report:${studentId}`) as
      | { contentJson: string; version: number }
      | undefined
    audit(database, context.actor.id, context.ownerId, 'REPORT_READ', studentId, requestId)
    return {
      report,
      text: saved
        ? (JSON.parse(saved.contentJson) as { text: string }).text
        : buildStudentReportTemplateText(report),
      version: saved?.version || 0,
      workspaceVersion: state.workspace.version,
      sourceVersion,
      columns,
      selectedProps,
      needsReview: Boolean(
        saved &&
        ((JSON.parse(saved.contentJson) as { sourceVersion?: string }).sourceVersion !==
          sourceVersion ||
          (JSON.parse(saved.contentJson) as { workspaceVersion: number; props?: string[] })
            .workspaceVersion !== state.workspace.version ||
          JSON.stringify((JSON.parse(saved.contentJson) as { props?: string[] }).props || []) !==
            JSON.stringify(selectedProps))
      )
    }
  }
  return inTransaction ? action() : transaction(database, action)
}
/** 正文人工审核后保存，独立文档版本及成绩版本防止旧报告覆盖新版结果。 */
export function saveStudentReport(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  studentId: string,
  input: {
    text: string
    version: number
    workspaceVersion: number
    sourceVersion: string
    props?: string[]
  },
  key: string,
  requestId: string
) {
  return mutate(
    database,
    context,
    'REPORT_SAVE',
    `${workspaceId}:${studentId}`,
    input,
    key,
    requestId,
    () => {
      const workspace = getWorkspace(database, context.ownerId, workspaceId),
        student = getEnrollment(database, context.ownerId, workspaceId, studentId)
      if (
        student.disabled ||
        student.departed ||
        input.text.length > 20000 ||
        workspace.version !== input.workspaceVersion
      )
        throw new BusinessError(
          409,
          'VERSION_CONFLICT',
          '成绩、名单已变化或正文超过限制，请刷新审核'
        )
      const current = readStudentReport(
        database,
        context,
        workspaceId,
        studentId,
        input.props || [],
        requestId,
        true
      )
      if (current.sourceVersion !== input.sourceVersion)
        throw new BusinessError(409, 'VERSION_CONFLICT', '成绩、历史参照或标签已变化，请刷新审核')
      const type = `student-report:${studentId}`,
        old = database
          .prepare(
            'SELECT version FROM workspace_documents WHERE ownerId=? AND workspaceId=? AND type=?'
          )
          .get(context.ownerId, workspaceId, type) as { version: number } | undefined
      if ((old?.version || 0) !== input.version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '报告已被其他设备修改')
      database
        .prepare(
          'INSERT INTO workspace_documents VALUES(?,?,?,?,?,?) ON CONFLICT(workspaceId,type) DO UPDATE SET contentJson=excluded.contentJson,version=excluded.version,updatedAt=excluded.updatedAt'
        )
        .run(
          workspaceId,
          context.ownerId,
          type,
          JSON.stringify({
            text: input.text,
            workspaceVersion: input.workspaceVersion,
            props: current.selectedProps,
            sourceVersion: current.sourceVersion
          }),
          input.version + 1,
          Date.now()
        )
      return { version: input.version + 1 }
    }
  )
}
