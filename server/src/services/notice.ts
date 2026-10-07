import { transaction } from '../db/migrate.js'
import { getWorkspace } from '../repositories/workspaces.js'
import { getAssessment, touchScoreWorkspace } from '../repositories/scores.js'
import { listComments, readNotice } from '../repositories/teaching.js'
import { scoreStateInTransaction } from './scoreProjection.js'
import { mutate, validateContext } from './mutations.js'
import { audit } from './accounts.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type {
  NoticeConfigType,
  NoticeDocumentType,
  TeachingSnapshotType
} from '../../../packages/shared/src/Teaching.js'

/** 标题/日期/等级线均服务端验证，不能保存其他账号或其他学期的科目 ID。 */
function validateNotice(config: NoticeConfigType): void {
  const date = new Date(`${config.noticeDate}T00:00:00Z`)
  if (
    !config.title.trim() ||
    config.title.length > 120 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(config.noticeDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== config.noticeDate ||
    !['score', 'grade'].includes(config.mode) ||
    config.subjects.length > 100
  )
    throw new BusinessError(400, 'INVALID_NOTICE', '通知单标题、日期或模式无效')
  const seen = new Set<string>()
  for (const subject of config.subjects) {
    const values = [subject.maxScore, subject.gradeAMin, subject.gradeBMin]
    if (
      seen.has(subject.assessmentId) ||
      values.some((value) => !Number.isFinite(value)) ||
      subject.maxScore <= 0 ||
      subject.maxScore > 100000 ||
      subject.gradeBMin < 0 ||
      subject.gradeAMin < subject.gradeBMin ||
      subject.gradeAMin > subject.maxScore
    )
      throw new BusinessError(400, 'INVALID_GRADE_RULE', '科目重复或等级分数线无效')
    seen.add(subject.assessmentId)
  }
}
export function saveNotice(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  input: { expectedVersion: number; config: NoticeConfigType },
  key: string,
  requestId: string
): NoticeDocumentType {
  validateNotice(input.config)
  return mutate(database, context, 'NOTICE_CONFIG_SAVE', workspaceId, input, key, requestId, () => {
    getWorkspace(database, context.ownerId, workspaceId)
    const current = readNotice(database, context.ownerId, workspaceId)
    if (current.version !== input.expectedVersion)
      throw new BusinessError(409, 'VERSION_CONFLICT', '通知单设置已被其他设备修改', { current })
    for (const subject of input.config.subjects) {
      if (getAssessment(database, context.ownerId, workspaceId, subject.assessmentId).disabled)
        throw new BusinessError(409, 'ASSESSMENT_DISABLED', '通知单不能选择禁用测评')
    }
    const config = { ...input.config, title: input.config.title.trim() }
    if (!current.version)
      database
        .prepare("INSERT INTO workspace_documents VALUES(?,?,'score-notice',?,1,?)")
        .run(workspaceId, context.ownerId, JSON.stringify(config), Date.now())
    else
      database
        .prepare(
          "UPDATE workspace_documents SET contentJson=?,version=version+1,updatedAt=? WHERE workspaceId=? AND ownerId=? AND type='score-notice' AND version=?"
        )
        .run(JSON.stringify(config), Date.now(), workspaceId, context.ownerId, current.version)
    touchScoreWorkspace(database, context.ownerId, workspaceId)
    return readNotice(database, context.ownerId, workspaceId)
  })
}
/** 每次导出重新验证权限，一次捕获成绩、名单、评语与设置，避免跨时点拼接。 */
export function readTeachingSnapshot(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  requestId: string
): TeachingSnapshotType {
  return transaction(database, () => {
    validateContext(database, context)
    const snapshot = {
      scores: scoreStateInTransaction(database, context, workspaceId),
      comments: listComments(database, context.ownerId, workspaceId),
      notice: readNotice(database, context.ownerId, workspaceId)
    }
    audit(
      database,
      context.actor.id,
      context.ownerId,
      'TEACHING_SNAPSHOT_READ',
      workspaceId,
      requestId
    )
    return snapshot
  })
}
