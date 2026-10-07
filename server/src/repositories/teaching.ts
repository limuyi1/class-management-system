import type { DatabaseType } from '../types/Account.js'
import type {
  CommentRecordType,
  NoticeConfigType,
  NoticeDocumentType
} from '../../../packages/shared/src/Teaching.js'

/** 已软删除名单的评语不展示，清空评语仍返回版本，防止旧设备覆盖。 */
export function listComments(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string
): CommentRecordType[] {
  return database
    .prepare(
      `SELECT c.studentId,CASE WHEN c.deletedAt IS NULL THEN c.text ELSE '' END AS text,c.version FROM comments c JOIN enrollments e
    ON e.workspaceId=c.workspaceId AND e.ownerId=c.ownerId AND e.studentId=c.studentId
    WHERE c.ownerId=? AND c.workspaceId=? AND e.deletedAt IS NULL ORDER BY e.sortIndex,e.studentId`
    )
    .all(ownerId, workspaceId) as CommentRecordType[]
}
export function getComment(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string,
  studentId: string
): CommentRecordType | null {
  return (
    (database
      .prepare(
        "SELECT studentId,CASE WHEN deletedAt IS NULL THEN text ELSE '' END AS text,version FROM comments WHERE ownerId=? AND workspaceId=? AND studentId=?"
      )
      .get(ownerId, workspaceId, studentId) as CommentRecordType | undefined) || null
  )
}
/** 此仓储只接受固定通知类型，不允许客户端选择任意文档类型批量赋值。 */
export function readNotice(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string
): NoticeDocumentType {
  const row = database
    .prepare(
      "SELECT contentJson,version FROM workspace_documents WHERE ownerId=? AND workspaceId=? AND type='score-notice'"
    )
    .get(ownerId, workspaceId) as { contentJson: string; version: number } | undefined
  return row
    ? { config: JSON.parse(row.contentJson) as NoticeConfigType, version: row.version }
    : { config: null, version: 0 }
}
