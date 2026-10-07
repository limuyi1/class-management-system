import { randomUUID } from 'node:crypto'
import { readAICall } from './calls.js'
import { readScoreState } from '../scoreProjection.js'
import { BusinessError } from '../errors.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'
import type { ScoreChangeType } from '../../../../packages/shared/src/Scores.js'

export interface AIScoreSourceType {
  scene: string
  workspaceId: string
  students: string[]
  assessments: { id: string; fullMark: number }[]
  versions: Record<string, number>
}
/** 人工审核识别值后仍使用生成前的版本；模型或客户端均不能指定写入版本。 */
export function previewAIScores(
  database: DatabaseType,
  context: AccessContextType,
  callId: string,
  items: { studentId: string; assessmentId: string; value: number | null }[]
) {
  const call = readAICall(database, context, callId)
  const result = call.result as
    | (NonNullable<typeof call.result> & { source?: AIScoreSourceType })
    | null
  const source = result?.source
  if (call.status !== 'DONE' || source?.scene !== 'recognize')
    throw new BusinessError(409, 'AI_RESULT_NOT_READY', '仅可审核已完成的成绩识别调用')
  readScoreState(database, context, source.workspaceId, 'ai-score-review')
  const changes: ScoreChangeType[] = [],
    errors: string[] = [],
    seen = new Set<string>()
  for (const item of items) {
    const assessment = source.assessments.find((row) => row.id === item.assessmentId),
      key = `${item.studentId}:${item.assessmentId}`
    if (
      !source.students.includes(item.studentId) ||
      !assessment ||
      seen.has(key) ||
      (item.value !== null &&
        (!Number.isFinite(item.value) || item.value < 0 || item.value > assessment.fullMark))
    ) {
      errors.push('存在身份、科目、分数无效或重复的识别值')
      continue
    }
    seen.add(key)
    changes.push({ ...item, expectedVersion: source.versions[key] || 0 })
  }
  if (!items.length || items.length > 2000) errors.push('审核结果为空或超过 2000 个单元格')
  const id = randomUUID()
  database
    .prepare('INSERT INTO import_previews VALUES(?,?,?,?,?,?)')
    .run(
      id,
      context.actor.id,
      context.ownerId,
      source.workspaceId,
      JSON.stringify({ changes, commentChanges: [], errors }),
      Date.now() + 86400000
    )
  return { id, changes, errors }
}
