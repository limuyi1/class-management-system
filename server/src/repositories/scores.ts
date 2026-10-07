import { BusinessError } from '../services/errors.js'
import type { DatabaseType } from '../types/Account.js'
import type { AssessmentType, ScoreRecordType } from '../../../packages/shared/src/Scores.js'

interface AssessmentRowType extends Omit<AssessmentType, 'disabled'> {
  disabled: number
}
/** 列表只暴露当前有效测评，不泄漏内部软删除与账号字段。 */
export function listAssessments(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string
): AssessmentType[] {
  const rows = database
    .prepare(
      `SELECT id,workspaceId,prop,label,sortIndex,disabled,fullMark,version
    FROM assessments WHERE ownerId=? AND workspaceId=? AND deletedAt IS NULL ORDER BY sortIndex,id`
    )
    .all(ownerId, workspaceId) as AssessmentRowType[]
  return rows.map((row) => ({ ...row, disabled: Boolean(row.disabled) }))
}
export function getAssessment(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string,
  id: string
): AssessmentType {
  const row = database
    .prepare(
      `SELECT id,workspaceId,prop,label,sortIndex,disabled,fullMark,version
    FROM assessments WHERE ownerId=? AND workspaceId=? AND id=? AND deletedAt IS NULL`
    )
    .get(ownerId, workspaceId, id) as AssessmentRowType | undefined
  if (!row) throw new BusinessError(404, 'NOT_FOUND', '测评不存在')
  return { ...row, disabled: Boolean(row.disabled) }
}
/** 已删除名单/列的成绩仍保存在库中，但正常页面不读取它们。 */
export function listScores(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string
): ScoreRecordType[] {
  return database
    .prepare(
      `SELECT s.studentId,s.assessmentId,s.value,s.version FROM scores s
    JOIN assessments a ON a.id=s.assessmentId AND a.workspaceId=s.workspaceId AND a.ownerId=s.ownerId
    JOIN enrollments e ON e.studentId=s.studentId AND e.workspaceId=s.workspaceId AND e.ownerId=s.ownerId
    WHERE s.ownerId=? AND s.workspaceId=? AND a.deletedAt IS NULL AND e.deletedAt IS NULL`
    )
    .all(ownerId, workspaceId) as ScoreRecordType[]
}
export function getScore(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string,
  studentId: string,
  assessmentId: string
): ScoreRecordType | null {
  return (
    (database
      .prepare(
        'SELECT studentId,assessmentId,value,version FROM scores WHERE ownerId=? AND workspaceId=? AND studentId=? AND assessmentId=?'
      )
      .get(ownerId, workspaceId, studentId, assessmentId) as ScoreRecordType | undefined) || null
  )
}
/** 业务变动递增目录版本，新学期沿用与参照修改不能依据过期快照提交。 */
export function touchScoreWorkspace(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string
): void {
  database
    .prepare('UPDATE workspaces SET version=version+1,updatedAt=? WHERE ownerId=? AND id=?')
    .run(Date.now(), ownerId, workspaceId)
}
