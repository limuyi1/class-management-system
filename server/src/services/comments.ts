import { transaction } from '../db/migrate.js'
import { getWorkspace, getEnrollment, listEnrollments } from '../repositories/workspaces.js'
import { getComment, listComments } from '../repositories/teaching.js'
import { touchScoreWorkspace } from '../repositories/scores.js'
import { mutate, validateContext } from './mutations.js'
import { audit } from './accounts.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type {
  CommentChangeType,
  CommentRecordType,
  CommentStateType
} from '../../../packages/shared/src/Teaching.js'

/** 评语按学生 ID 保存，版本 0 表示从未保存；任意冲突整批回滚。 */
export function writeComments(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  changes: CommentChangeType[],
  key: string,
  requestId: string
): { items: CommentRecordType[] } {
  const seen = new Set<string>()
  if (!changes.length || changes.length > 2000)
    throw new BusinessError(400, 'INVALID_BATCH', '一次提交 1–2000 条评语')
  for (const change of changes) {
    if (seen.has(change.studentId))
      throw new BusinessError(400, 'DUPLICATE_STUDENT', '批次包含重复学生')
    seen.add(change.studentId)
    if (
      typeof change.text !== 'string' ||
      change.text.length > 5000 ||
      !Number.isInteger(change.expectedVersion) ||
      change.expectedVersion < 0
    )
      throw new BusinessError(400, 'INVALID_COMMENT', '评语最多 5000 字，版本需为非负整数')
  }
  return mutate(database, context, 'COMMENTS_BATCH', workspaceId, changes, key, requestId, () => {
    getWorkspace(database, context.ownerId, workspaceId)
    const conflicts: Array<{ studentId: string; current: CommentRecordType | null }> = []
    for (const change of changes) {
      const student = getEnrollment(database, context.ownerId, workspaceId, change.studentId)
      if (student.disabled || student.departed)
        throw new BusinessError(409, 'COMMENT_READ_ONLY', '禁用或转出学生不可编辑评语')
      const current = getComment(database, context.ownerId, workspaceId, change.studentId)
      if ((current?.version ?? 0) !== change.expectedVersion)
        conflicts.push({ studentId: change.studentId, current })
    }
    if (conflicts.length)
      throw new BusinessError(409, 'VERSION_CONFLICT', '评语已变化，整个批次未保存', { conflicts })
    const items = changes.map((change) => {
      const text = change.text.trim()
      const deletedAt = text ? null : Date.now()
      if (change.expectedVersion === 0)
        database
          .prepare(
            'INSERT INTO comments(workspaceId,ownerId,studentId,text,deletedAt) VALUES(?,?,?,?,?)'
          )
          .run(workspaceId, context.ownerId, change.studentId, text, deletedAt)
      else
        database
          .prepare(
            "UPDATE comments SET text=CASE WHEN ?='' THEN text ELSE ? END,deletedAt=?,version=version+1 WHERE ownerId=? AND workspaceId=? AND studentId=? AND version=?"
          )
          .run(
            text,
            text,
            deletedAt,
            context.ownerId,
            workspaceId,
            change.studentId,
            change.expectedVersion
          )
      return getComment(database, context.ownerId, workspaceId, change.studentId)!
    })
    touchScoreWorkspace(database, context.ownerId, workspaceId)
    return { items }
  })
}
/** 一次事务读取名单与评语，代管读取也记录真实操作者。 */
export function readComments(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  requestId: string
): CommentStateType {
  return transaction(database, () => {
    validateContext(database, context)
    const state = {
      workspace: getWorkspace(database, context.ownerId, workspaceId),
      students: listEnrollments(database, context.ownerId, workspaceId),
      comments: listComments(database, context.ownerId, workspaceId)
    }
    if (context.actor.id !== context.ownerId)
      audit(database, context.actor.id, context.ownerId, 'COMMENTS_READ', workspaceId, requestId)
    return state
  })
}
