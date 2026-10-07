import { BusinessError } from '../services/errors.js'
import type { DatabaseType } from '../types/Account.js'
import type { EnrollmentType, WorkspaceRecordType } from '../../../packages/shared/src/Workspace.js'

/** Repository 永远要求 ownerId；即使管理员也不能省略归属条件。 */
export function getWorkspace(
  database: DatabaseType,
  ownerId: string,
  id: string
): WorkspaceRecordType {
  const workspace = database
    .prepare('SELECT * FROM workspaces WHERE id=? AND ownerId=? AND deletedAt IS NULL')
    .get(id, ownerId) as WorkspaceRecordType | undefined
  if (!workspace) throw new BusinessError(404, 'NOT_FOUND', '班级学期不存在')
  return workspace
}

/** 使用显式 DTO 将 SQLite 0/1 转为布尔值，不把内部 owner 及排序细节泄漏到行对象。 */
export function listEnrollments(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string
): EnrollmentType[] {
  getWorkspace(database, ownerId, workspaceId)
  const records = database
    .prepare(
      'SELECT * FROM enrollments WHERE ownerId=? AND workspaceId=? AND deletedAt IS NULL ORDER BY sortIndex,studentId'
    )
    .all(ownerId, workspaceId) as Array<{
    studentId: string
    name: string
    disabled: number
    departed: number
    departedAt: number | null
    version: number
  }>
  return records.map((row) => ({
    studentId: row.studentId,
    name: row.name,
    disabled: Boolean(row.disabled),
    departed: Boolean(row.departed),
    departedAt: row.departedAt,
    version: row.version
  }))
}

/** 修改行必须同时匹配学期、账号、学生，不允许使用其他学期的同名 ID。 */
export function getEnrollment(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string,
  studentId: string
): EnrollmentType {
  const row = database
    .prepare(
      'SELECT * FROM enrollments WHERE ownerId=? AND workspaceId=? AND studentId=? AND deletedAt IS NULL'
    )
    .get(ownerId, workspaceId, studentId) as
    | {
        studentId: string
        name: string
        disabled: number
        departed: number
        departedAt: number | null
        version: number
      }
    | undefined
  if (!row) throw new BusinessError(404, 'NOT_FOUND', '本期学生不存在')
  return {
    studentId: row.studentId,
    name: row.name,
    disabled: Boolean(row.disabled),
    departed: Boolean(row.departed),
    departedAt: row.departedAt,
    version: row.version
  }
}
