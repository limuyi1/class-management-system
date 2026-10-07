import { mutate } from './mutations.js'
import { getWorkspace } from '../repositories/workspaces.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
/** 班级/学期软删除前阻止外部历史参照，所有教学记录继续保留。 */
export function deleteWorkspace(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  version: number,
  wholeClass: boolean,
  key: string,
  requestId: string
) {
  return mutate(
    database,
    context,
    'WORKSPACE_DELETE',
    id,
    { version, wholeClass },
    key,
    requestId,
    () => {
      const workspace = getWorkspace(database, context.ownerId, id)
      if (workspace.version !== version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '学期已变化')
      const ids = wholeClass
        ? (
            database
              .prepare(
                'SELECT id FROM workspaces WHERE ownerId=? AND classId=? AND deletedAt IS NULL'
              )
              .all(context.ownerId, workspace.classId) as { id: string }[]
          ).map((row) => row.id)
        : [id]
      for (const source of ids) {
        const targets = database
          .prepare(
            'SELECT r.workspaceId FROM workspace_references r JOIN workspaces w ON w.id=r.workspaceId WHERE r.ownerId=? AND r.sourceWorkspaceId=? AND w.deletedAt IS NULL'
          )
          .all(context.ownerId, source) as { workspaceId: string }[]
        if (targets.some((row) => !ids.includes(row.workspaceId)))
          throw new BusinessError(409, 'WORKSPACE_REFERENCED', '先移除其他学期的历史参照，再删除')
      }
      for (const target of ids)
        database
          .prepare('UPDATE workspaces SET deletedAt=?,version=version+1 WHERE id=? AND ownerId=?')
          .run(Date.now(), target, context.ownerId)
      return { success: true }
    }
  )
}
