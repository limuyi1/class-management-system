import { getEnrollment } from '../../repositories/workspaces.js'
import { randomUUID } from 'node:crypto'
import { mutate } from '../mutations.js'
import { BusinessError } from '../errors.js'
import { v5StateInTransaction, readV5Document } from './state.js'
import { scoreStateInTransaction } from '../scoreProjection.js'
import { addStudent, editStudent, deleteStudent } from '../students.js'
import { createAssessment, editAssessment, deleteAssessment } from '../assessments.js'
import { writeScores } from '../scores.js'
import { writeComments } from '../comments.js'
import { listComments } from '../../repositories/teaching.js'
import { saveClassroomTool, deleteClassroomTool } from '../classroomTools.js'
import { saveResource } from '../resources.js'
import { editWorkspace } from '../workspaces.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'
import type { ClassroomToolContentType } from '../../../../packages/shared/src/ClassroomTools.js'
import type { V5WriteType, V5StateType } from '../../../../packages/shared/src/V5.js'
import type { ScoreChangeType } from '../../../../packages/shared/src/Scores.js'

const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const rows = (value: unknown, max: number): Record<string, unknown>[] => {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
  )
    throw new BusinessError(400, 'INVALID_INPUT', '原页面数据格式或数量无效')
  return value as Record<string, unknown>[]
}
/** 把原页面的状态提交转换为规范业务操作；整体 CAS、幂等和事务避免半份写入。 */
export function writeV5State(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  input: V5WriteType,
  key: string,
  requestId: string
): V5StateType {
  const allowed = [
    'dataSource',
    'setting',
    'configuration',
    'tools',
    'aiConfig',
    'overviewAnalysis',
    'seatingChart',
    'dutyRoster',
    'scoreNotice'
  ]
  if (
    Object.keys(input.stores).some((name) => !allowed.includes(name)) ||
    JSON.stringify(input.stores).length > 3000000
  )
    throw new BusinessError(400, 'INVALID_INPUT', '包含无效状态或内容过大')
  if (
    input.stores.aiConfig &&
    Object.keys(input.stores.aiConfig).some((name) => name !== 'prompts')
  )
    throw new BusinessError(400, 'INVALID_INPUT', '个人密钥必须使用专用设置接口')
  return mutate(database, context, 'V5_STATE_SAVE', id, input, key, requestId, () => {
    const before = v5StateInTransaction(database, context, id)
    if (before.fingerprint !== input.fingerprint)
      throw new BusinessError(
        409,
        'VERSION_CONFLICT',
        '服务器数据已被其他设备修改，草稿保留，请刷新核对'
      )
    let sequence = 0
    const childKey = () => `${key}_${sequence++}`
    let state = scoreStateInTransaction(database, context, id)
    const students = input.stores.dataSource
      ? rows(input.stores.dataSource.students, 2000)
      : (before.stores.dataSource.students as Record<string, unknown>[])
    if (new Set(students.map((row) => row.studentId)).size !== students.length)
      throw new BusinessError(400, 'INVALID_INPUT', '学生身份重复')
    for (const row of students) {
      const studentId = String(row.studentId)
      if (!/^[0-9a-f-]{36}$/i.test(studentId) || typeof row.name !== 'string')
        throw new BusinessError(400, 'INVALID_INPUT', '学生身份或姓名无效')
      if (
        ['disabled', 'departed'].some(
          (field) => row[field] !== undefined && typeof row[field] !== 'boolean'
        )
      )
        throw new BusinessError(400, 'INVALID_INPUT', '学生状态必须为布尔值')
      const old = state.students.find((student) => student.studentId === studentId)
      if (!old) {
        if (
          database
            .prepare(
              'SELECT studentId FROM enrollments WHERE workspaceId=? AND ownerId=? AND studentId=?'
            )
            .get(id, context.ownerId, studentId)
        )
          throw new BusinessError(409, 'STUDENT_DELETED', '学生已删除，不能覆盖恢复')
        database
          .prepare('INSERT OR IGNORE INTO students VALUES(?,?,?)')
          .run(context.ownerId, studentId, Date.now())
        addStudent(database, context, id, { name: row.name, studentId }, childKey(), requestId)
      }
      const current = getEnrollment(database, context.ownerId, id, studentId)
      const next = {
        name: row.name,
        disabled: Boolean(row.disabled),
        departed: Boolean(row.departed),
        version: current.version
      }
      if (
        current.name !== next.name ||
        current.disabled !== next.disabled ||
        current.departed !== next.departed
      )
        editStudent(database, context, id, studentId, next, childKey(), requestId)
    }
    if (input.stores.dataSource) {
      let reordered = false
      for (const [index, row] of students.entries())
        reordered =
          Boolean(
            database
              .prepare(
                'UPDATE enrollments SET sortIndex=?,version=version+1 WHERE workspaceId=? AND ownerId=? AND studentId=? AND sortIndex!=?'
              )
              .run(index, id, context.ownerId, String(row.studentId), index).changes
          ) || reordered
      if (reordered)
        database
          .prepare('UPDATE workspaces SET version=version+1,updatedAt=? WHERE id=? AND ownerId=?')
          .run(Date.now(), id, context.ownerId)
    }
    if (input.stores.setting) {
      const columns = rows(input.stores.setting.scoreColumns, 201).filter(
        (row) => row.prop !== 'name'
      )
      if (
        new Set(columns.map((row) => row.prop)).size !== columns.length ||
        columns.some((row) => row.reference)
      )
        throw new BusinessError(400, 'INVALID_INPUT', '测评字段重复或试图保存历史参照')
      for (const [index, column] of columns.entries()) {
        const old = state.assessments.find((row) => row.prop === column.prop)
        const value = {
          prop: String(column.prop),
          label: String(column.label),
          sortIndex: index,
          disabled: Boolean(column.disabled),
          fullMark: column.fullMark == null ? null : Number(column.fullMark)
        }
        if (!old) createAssessment(database, context, id, value, childKey(), requestId)
        else if (
          old.label !== value.label ||
          old.sortIndex !== index ||
          old.disabled !== value.disabled ||
          old.fullMark !== value.fullMark
        )
          editAssessment(
            database,
            context,
            id,
            old.id,
            { ...value, version: old.version },
            childKey(),
            requestId
          )
      }
      for (const old of state.assessments)
        if (!columns.some((column) => column.prop === old.prop))
          deleteAssessment(database, context, id, old.id, old.version, childKey(), requestId)
    }
    state = scoreStateInTransaction(database, context, id)
    const changes: ScoreChangeType[] = []
    const scoreMap = new Map(
      state.scores.map((score) => [`${score.studentId}:${score.assessmentId}`, score])
    )
    for (const row of students)
      for (const column of state.assessments) {
        const raw = row[column.prop],
          value =
            raw == null || raw === ''
              ? null
              : typeof raw === 'boolean' || typeof raw === 'object'
                ? NaN
                : Number(raw)
        const old = scoreMap.get(`${row.studentId}:${column.id}`)
        if (value !== (old?.value ?? null))
          changes.push({
            studentId: String(row.studentId),
            assessmentId: column.id,
            value,
            expectedVersion: old?.version || 0
          })
      }
    for (let start = 0; start < changes.length; start += 2000)
      writeScores(database, context, id, changes.slice(start, start + 2000), childKey(), requestId)
    const comments = listComments(database, context.ownerId, id)
    const commentChanges = students.flatMap((row) => {
      const old = comments.find((comment) => comment.studentId === row.studentId)
      const text = String(row.comment || '')
      return text !== (old?.text || '')
        ? [{ studentId: String(row.studentId), text, expectedVersion: old?.version || 0 }]
        : []
    })
    if (commentChanges.length)
      writeComments(database, context, id, commentChanges, childKey(), requestId)
    for (const old of state.students)
      if (!students.some((row) => row.studentId === old.studentId))
        deleteStudent(database, context, id, old.studentId, old.version, childKey(), requestId)
    const extras = { ...readV5Document(database, context.ownerId, id), ...input.stores }
    if (input.stores.setting || input.stores.dataSource) {
      const setting = extras.setting || before.stores.setting
      const categories = rows(setting.tagCategories || [], 100).map((row) => String(row.prop))
      const categoryLabels = Object.fromEntries(
        rows(setting.tagCategories || [], 100).map((row) => [
          String(row.prop),
          String(row.label || row.prop)
        ])
      )
      const tags = setting.tags || {}
      const assignments = Object.fromEntries(
        students.map((row) => [
          String(row.studentId),
          categories.flatMap((category) =>
            Array.isArray((row.tags as Record<string, unknown> | undefined)?.[category])
              ? (row.tags as Record<string, string[]>)[category]!
              : []
          )
        ])
      )
      const old = database
        .prepare(
          "SELECT id,version FROM business_resources WHERE ownerId=? AND kind='tags' AND workspaceId=? AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1"
        )
        .get(context.ownerId, id) as { id: string; version: number } | undefined
      saveResource(
        database,
        context,
        {
          id: old?.id || randomUUID(),
          kind: 'tags',
          workspaceId: id,
          name: '评语标签',
          content: { categories, categoryLabels, tags, assignments },
          version: old?.version || 0
        },
        childKey(),
        requestId
      )
    }
    for (const [storeId, collection, kind] of [
      ['seatingChart', 'charts', 'seating'],
      ['dutyRoster', 'rosters', 'duty']
    ] as const)
      if (input.stores[storeId]) {
        const values = rows(input.stores[storeId][collection], 100)
        const old = database
          .prepare(
            'SELECT id,version,contentJson FROM classroom_tools WHERE ownerId=? AND workspaceId=? AND kind=? AND deletedAt IS NULL'
          )
          .all(context.ownerId, id, kind) as { id: string; version: number; contentJson: string }[]
        for (const value of values) {
          const previous = old.find((row) => row.id === value.id)
          if (!previous || !equal(JSON.parse(previous.contentJson), value))
            saveClassroomTool(
              database,
              context,
              id,
              String(value.id),
              {
                kind,
                expectedVersion: previous?.version || 0,
                content: value as unknown as ClassroomToolContentType
              },
              childKey(),
              requestId
            )
        }
        for (const previous of old)
          if (!values.some((value) => value.id === previous.id))
            deleteClassroomTool(
              database,
              context,
              id,
              previous.id,
              previous.version,
              childKey(),
              requestId
            )
      }
    if (input.stores.configuration || input.stores.tools || input.stores.aiConfig) {
      const old = database
        .prepare(
          "SELECT id,version,contentJson FROM business_resources WHERE ownerId=? AND kind='settings' AND workspaceId IS NULL AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1"
        )
        .get(context.ownerId) as { id: string; version: number; contentJson: string } | undefined
      const content = old ? (JSON.parse(old.contentJson) as Record<string, unknown>) : {}
      const configuration = input.stores.configuration || {}
      const layout = {
        ...(content.layout as Record<string, unknown>),
        ...Object.fromEntries(
          Object.entries(configuration).filter(
            ([key]) => !['inputScoreTab', 'recentScoreEntries', 'scoreFullMark'].includes(key)
          )
        ),
        ...(input.stores.tools ? { tools: input.stores.tools } : {}),
        ...(input.stores.aiConfig ? { aiPrompts: input.stores.aiConfig.prompts } : {})
      }
      saveResource(
        database,
        context,
        {
          id: old?.id || randomUUID(),
          kind: 'settings',
          workspaceId: null,
          name: '账号业务设置',
          version: old?.version || 0,
          content: {
            ...content,
            layout,
            ...(configuration.fontSize ? { fontSize: configuration.fontSize } : {}),
            ...(input.stores.tools?.cardTemplates
              ? { templates: input.stores.tools.cardTemplates }
              : {})
          }
        },
        childKey(),
        requestId
      )
      if (
        configuration.scoreFullMark !== undefined &&
        Number(configuration.scoreFullMark) !== state.workspace.scoreFullMark
      ) {
        state = scoreStateInTransaction(database, context, id)
        editWorkspace(
          database,
          context,
          id,
          { ...state.workspace, scoreFullMark: Number(configuration.scoreFullMark) },
          childKey(),
          requestId
        )
      }
    }
    // 只保存页面附加状态，规范名单/成绩仍通过上方服务更新。
    database
      .prepare(
        "INSERT INTO workspace_documents VALUES(?,?,'v5-ui',?,1,?) ON CONFLICT(workspaceId,type) DO UPDATE SET contentJson=excluded.contentJson,version=version+1,updatedAt=excluded.updatedAt"
      )
      .run(id, context.ownerId, JSON.stringify(extras), Date.now())
    return v5StateInTransaction(database, context, id)
  })
}
