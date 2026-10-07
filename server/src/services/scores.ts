import { getEnrollment, getWorkspace } from '../repositories/workspaces.js'
import { getAssessment, getScore, touchScoreWorkspace } from '../repositories/scores.js'
import { mutate } from './mutations.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type {
  ScoreChangeType,
  ScoreConflictType,
  ScoreRecordType
} from '../../../packages/shared/src/Scores.js'

/** 原始分只要求有限数值，允许加分超过满分；不自动截断、补零或转成字符串。 */
export function writeScores(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  changes: ScoreChangeType[],
  key: string,
  requestId: string
): { items: ScoreRecordType[] } {
  if (!changes.length || changes.length > 2000)
    throw new BusinessError(400, 'INVALID_BATCH', '一次提交 1–2000 个单元格')
  const seen = new Set<string>()
  for (const change of changes) {
    if (change.value !== null && (!Number.isFinite(change.value) || Math.abs(change.value) > 1e9))
      throw new BusinessError(400, 'INVALID_SCORE', '成绩必须为空或有效数值')
    if (!Number.isInteger(change.expectedVersion) || change.expectedVersion < 0)
      throw new BusinessError(400, 'INVALID_VERSION', '成绩版本无效')
    const identity = `${change.studentId}/${change.assessmentId}`
    if (seen.has(identity)) throw new BusinessError(400, 'DUPLICATE_CELL', '批次包含重复单元格')
    seen.add(identity)
  }
  return mutate(database, context, 'SCORES_BATCH', workspaceId, changes, key, requestId, () => {
    getWorkspace(database, context.ownerId, workspaceId)
    const conflicts: ScoreConflictType[] = []
    // 先检查全部资源和版本，任何冲突均不写入，返回脱敏的当前单元格。
    for (const change of changes) {
      const student = getEnrollment(database, context.ownerId, workspaceId, change.studentId)
      const assessment = getAssessment(database, context.ownerId, workspaceId, change.assessmentId)
      if (student.disabled || student.departed || assessment.disabled)
        throw new BusinessError(409, 'SCORE_READ_ONLY', '禁用或转出的学生、禁用测评不可录分')
      const current = getScore(
        database,
        context.ownerId,
        workspaceId,
        change.studentId,
        change.assessmentId
      )
      if ((current?.version ?? 0) !== change.expectedVersion)
        conflicts.push({ studentId: change.studentId, assessmentId: change.assessmentId, current })
    }
    if (conflicts.length)
      throw new BusinessError(409, 'VERSION_CONFLICT', '成绩已被其他设备修改，整个批次未保存', {
        conflicts
      })
    const items: ScoreRecordType[] = []
    for (const change of changes) {
      if (change.expectedVersion === 0)
        database
          .prepare(
            'INSERT INTO scores(workspaceId,ownerId,studentId,assessmentId,value) VALUES(?,?,?,?,?)'
          )
          .run(workspaceId, context.ownerId, change.studentId, change.assessmentId, change.value)
      else
        database
          .prepare(
            'UPDATE scores SET value=?,version=version+1 WHERE ownerId=? AND workspaceId=? AND studentId=? AND assessmentId=? AND version=?'
          )
          .run(
            change.value,
            context.ownerId,
            workspaceId,
            change.studentId,
            change.assessmentId,
            change.expectedVersion
          )
      items.push(
        getScore(database, context.ownerId, workspaceId, change.studentId, change.assessmentId)!
      )
    }
    touchScoreWorkspace(database, context.ownerId, workspaceId)
    return { items }
  })
}
