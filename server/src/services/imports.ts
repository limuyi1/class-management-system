import { commitRosterImport } from './rosterImport.js'
import type { RosterImportItemType } from './rosterImport.js'
import { randomUUID } from 'node:crypto'
import { validateContext } from './mutations.js'
import { readScoreState } from './scoreProjection.js'
import { readComments, writeComments } from './comments.js'
import { writeScores } from './scores.js'
import { BusinessError } from './errors.js'
import type { ScoreChangeType } from '../../../packages/shared/src/Scores.js'
import type { CommentChangeType } from '../../../packages/shared/src/Teaching.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
export interface ImportMappingType {
  kind?: 'scores' | 'comments' | 'roster'
  idColumn: number | null
  nameColumn: number
  fields: { column: number; assessmentId: string }[]
  commentColumn: number | null
  headerRow: number
}
interface PreviewRecordType {
  workspaceId: string
  contentJson: string
  expiresAt: number
}
/** 文件解析结果绑定操作者与目标，客户端只提交列映射，不能篡改原文件数据。 */
export function storeImportRows(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  rows: unknown[][]
): string {
  readScoreState(database, context, workspaceId, 'import-read')
  const id = randomUUID()
  database
    .prepare('INSERT INTO import_previews VALUES(?,?,?,?,?,?)')
    .run(
      id,
      context.actor.id,
      context.ownerId,
      workspaceId,
      JSON.stringify({ rows }),
      Date.now() + 86400000
    )
  return id
}
function record(database: DatabaseType, context: AccessContextType, id: string): PreviewRecordType {
  validateContext(database, context)
  const row = database
    .prepare('SELECT * FROM import_previews WHERE id=? AND actorId=? AND ownerId=?')
    .get(id, context.actor.id, context.ownerId) as PreviewRecordType | undefined
  if (!row || row.expiresAt < Date.now())
    throw new BusinessError(404, 'IMPORT_EXPIRED', '导入预览已过期或不存在')
  return row
}
/** 名字有歧义时拒绝匹配；学生 ID 优先，零分与空值严格区分。 */
export function previewImport(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  mapping: ImportMappingType
) {
  const row = record(database, context, id),
    raw = JSON.parse(row.contentJson) as { rows: unknown[][]; mapping?: ImportMappingType }
  const state = readScoreState(database, context, row.workspaceId, 'import-preview')
  const comments = readComments(database, context, row.workspaceId, 'import-preview')
  const changes: ScoreChangeType[] = [],
    commentChanges: CommentChangeType[] = [],
    errors: string[] = []
  if (new Set(mapping.fields.map((field) => field.assessmentId)).size !== mapping.fields.length)
    errors.push('同一个科目不能重复映射')
  if (mapping.kind === 'roster') {
    const roster: RosterImportItemType[] = []
    const ids = new Set<string>()
    raw.rows.slice(mapping.headerRow + 1).forEach((values, index) => {
      if (values.every((value) => value === null || value === '')) return
      const name = String(values[mapping.nameColumn] ?? '').trim()
      const identity =
        mapping.idColumn === null ? '' : String(values[mapping.idColumn] ?? '').trim()
      if (!name || name.length > 60) errors.push(`第 ${index + mapping.headerRow + 2} 行：姓名无效`)
      if (
        identity &&
        (ids.has(identity) ||
          !database
            .prepare('SELECT id FROM students WHERE ownerId=? AND id=?')
            .get(context.ownerId, identity) ||
          database
            .prepare(
              'SELECT studentId FROM enrollments WHERE ownerId=? AND workspaceId=? AND studentId=?'
            )
            .get(context.ownerId, row.workspaceId, identity))
      )
        errors.push(`第 ${index + mapping.headerRow + 2} 行：历史身份无效、重复或已在名单中`)
      if (identity) ids.add(identity)
      roster.push({ name, ...(identity ? { studentId: identity } : {}) })
    })
    if (!roster.length || roster.length + state.students.length > 2000)
      errors.push('名单为空或超过 2000 人')
    database
      .prepare('UPDATE import_previews SET contentJson=? WHERE id=?')
      .run(
        JSON.stringify({
          rows: raw.rows,
          mapping,
          roster,
          workspaceVersion: state.workspace.version,
          errors
        }),
        id
      )
    return { id, changes: [], commentChanges: [], roster, errors }
  }
  const seen = new Set<string>()
  raw.rows.slice(mapping.headerRow + 1).forEach((values, index) => {
    if (values.every((value) => value === null || value === '')) return
    const name = String(values[mapping.nameColumn] ?? '').trim(),
      identity = mapping.idColumn === null ? '' : String(values[mapping.idColumn] ?? '').trim()
    const candidates = state.students.filter((student) =>
      identity ? student.studentId === identity : student.name === name
    )
    const student = candidates[0]
    if (
      candidates.length !== 1 ||
      !student ||
      student.disabled ||
      student.departed ||
      seen.has(student.studentId)
    ) {
      errors.push(`第 ${index + mapping.headerRow + 2} 行：姓名重复、身份缺失或不可编辑`)
      return
    }
    seen.add(student.studentId)
    for (const field of mapping.fields) {
      const assessment = state.assessments.find(
        (item) => item.id === field.assessmentId && !item.disabled
      )
      const value = values[field.column]
      const number = value === null || value === undefined || value === '' ? null : Number(value)
      if (
        !assessment ||
        typeof value === 'boolean' ||
        (number !== null &&
          (!Number.isFinite(number) ||
            number < 0 ||
            number > (assessment.fullMark ?? state.workspace.scoreFullMark)))
      ) {
        errors.push(`第 ${index + mapping.headerRow + 2} 行：成绩或科目无效`)
        continue
      }
      changes.push({
        studentId: student.studentId,
        assessmentId: assessment.id,
        value: number,
        expectedVersion:
          state.scores.find(
            (item) => item.studentId === student.studentId && item.assessmentId === assessment.id
          )?.version || 0
      })
    }
    if (mapping.commentColumn !== null) {
      const text = String(values[mapping.commentColumn] ?? '')
      if (text.length > 5000) errors.push(`第 ${index + mapping.headerRow + 2} 行：评语过长`)
      else
        commentChanges.push({
          studentId: student.studentId,
          text,
          expectedVersion:
            comments.comments.find((item) => item.studentId === student.studentId)?.version || 0
        })
    }
  })
  if (changes.length > 2000) errors.push('一次最多导入 2000 个成绩单元格，请分批处理')
  database
    .prepare('UPDATE import_previews SET contentJson=? WHERE id=?')
    .run(JSON.stringify({ rows: raw.rows, mapping, changes, commentChanges, errors }), id)
  return { id, changes, commentChanges, errors }
}
/** 预览后按捕获版本提交，冲突整批回滚；成绩与评语分开确认，避免跨批部分成功。 */
export function commitImport(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  kind: 'scores' | 'comments' | 'roster',
  key: string,
  requestId: string
) {
  const row = record(database, context, id),
    data = JSON.parse(row.contentJson) as {
      roster?: RosterImportItemType[]
      workspaceVersion?: number
      changes?: ScoreChangeType[]
      commentChanges?: CommentChangeType[]
      errors?: string[]
    }
  if (!data.errors || data.errors.length)
    throw new BusinessError(400, 'INVALID_IMPORT', '请先完成无错误的预览')
  if (kind === 'roster')
    return commitRosterImport(
      database,
      context,
      row.workspaceId,
      id,
      data.roster || [],
      data.workspaceVersion || 0,
      key,
      requestId
    )
  if (kind === 'scores')
    return writeScores(database, context, row.workspaceId, data.changes || [], key, requestId)
  return writeComments(
    database,
    context,
    row.workspaceId,
    data.commentChanges || [],
    key,
    requestId
  )
}
