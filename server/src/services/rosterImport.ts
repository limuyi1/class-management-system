import { randomUUID } from 'node:crypto'
import { getWorkspace } from '../repositories/workspaces.js'
import { mutate } from './mutations.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'

export interface RosterImportItemType {
  name: string
  studentId?: string
}
/** 名单导入逐行创建身份；显式历史 ID 必须属于本人，不按同名自动合并。 */
export function commitRosterImport(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  id: string,
  items: RosterImportItemType[],
  version: number,
  key: string,
  requestId: string
) {
  return mutate(
    database,
    context,
    'ROSTER_IMPORT',
    workspaceId,
    { id, items, version },
    key,
    requestId,
    () => {
      const workspace = getWorkspace(database, context.ownerId, workspaceId)
      if (workspace.version !== version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '名单或学期已变化，请重新预览')
      const existing = database
        .prepare('SELECT studentId,sortIndex FROM enrollments WHERE ownerId=? AND workspaceId=?')
        .all(context.ownerId, workspaceId) as { studentId: string; sortIndex: number }[]
      if (!items.length || existing.length + items.length > 2000)
        throw new BusinessError(400, 'STUDENT_LIMIT', '名单为空或超过 2000 人')
      let order = Math.max(0, ...existing.map((row) => row.sortIndex))
      const identities = new Set(existing.map((row) => row.studentId))
      for (const item of items) {
        if (!item.name.trim() || item.name.length > 60)
          throw new BusinessError(400, 'INVALID_NAME', '姓名需为 1–60 字')
        const studentId = item.studentId || randomUUID()
        if (identities.has(studentId))
          throw new BusinessError(409, 'STUDENT_EXISTS', '学生已在本期名单中或重复')
        if (item.studentId) {
          if (
            !database
              .prepare('SELECT id FROM students WHERE ownerId=? AND id=?')
              .get(context.ownerId, studentId)
          )
            throw new BusinessError(404, 'NOT_FOUND', '历史学生 ID 不属于当前账号')
        } else
          database
            .prepare('INSERT INTO students VALUES(?,?,?)')
            .run(context.ownerId, studentId, Date.now())
        identities.add(studentId)
        database
          .prepare(
            'INSERT INTO enrollments(workspaceId,ownerId,studentId,name,sortIndex) VALUES(?,?,?,?,?)'
          )
          .run(workspaceId, context.ownerId, studentId, item.name.trim(), ++order)
      }
      database
        .prepare('UPDATE workspaces SET version=version+1,updatedAt=? WHERE ownerId=? AND id=?')
        .run(Date.now(), context.ownerId, workspaceId)
      return { added: items.length }
    }
  )
}
