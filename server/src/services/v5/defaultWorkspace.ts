import { transaction } from '../../db/migrate.js'
import { requireTeachingOwner } from '../../policies/access.js'
import { createWorkspace, listWorkspaces } from '../workspaces.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'

/** 新老师沿用原版默认工作区；并发设备初始化只创建一份，不使用本地数据库。 */
export function ensureDefaultWorkspace(
  database: DatabaseType,
  context: AccessContextType,
  key: string,
  requestId: string
) {
  return transaction(database, () => {
    requireTeachingOwner(database, context.ownerId)
    const existing = listWorkspaces(database, context)
    if (existing.length) return existing[0]!
    const previous = database
      .prepare('SELECT id FROM workspaces WHERE ownerId=? LIMIT 1')
      .get(context.ownerId)
    return createWorkspace(
      database,
      context,
      { className: '默认班级', termName: previous ? `当前学期 ${Date.now()}` : '当前学期' },
      key,
      requestId
    )
  })
}
