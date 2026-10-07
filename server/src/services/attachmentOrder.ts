import { mutate } from './mutations.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
/** 排序交换只影响当前账号的相邻有效素材，版本递增使旧列表及时发现变化。 */
export function moveAttachment(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  input: { version: number; direction: 'up' | 'down' },
  key: string,
  requestId: string
) {
  return mutate(database, context, 'ATTACHMENT_MOVE', id, input, key, requestId, () => {
    const row = database
      .prepare(
        'SELECT version,sortIndex FROM attachments WHERE id=? AND ownerId=? AND deletedAt IS NULL'
      )
      .get(id, context.ownerId) as { version: number; sortIndex: number } | undefined
    if (!row || row.version !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', '素材列表已变化，请刷新')
    const comparison = input.direction === 'up' ? '<' : '>',
      order = input.direction === 'up' ? 'DESC' : 'ASC'
    const other = database
      .prepare(
        `SELECT id,sortIndex FROM attachments WHERE ownerId=? AND deletedAt IS NULL AND sortIndex${comparison}? ORDER BY sortIndex ${order} LIMIT 1`
      )
      .get(context.ownerId, row.sortIndex) as { id: string; sortIndex: number } | undefined
    if (other) {
      database
        .prepare('UPDATE attachments SET sortIndex=?,version=version+1 WHERE id=? AND ownerId=?')
        .run(other.sortIndex, id, context.ownerId)
      database
        .prepare('UPDATE attachments SET sortIndex=?,version=version+1 WHERE id=? AND ownerId=?')
        .run(row.sortIndex, other.id, context.ownerId)
    }
    return { success: true }
  })
}

/** 原素材页拖拽提交完整顺序，版本和名单变化时整批拒绝。 */
export function reorderAttachments(
  database: DatabaseType,
  context: AccessContextType,
  items: { id: string; version: number }[],
  key: string,
  requestId: string
) {
  return mutate(
    database,
    context,
    'ATTACHMENT_ORDER',
    context.ownerId,
    items,
    key,
    requestId,
    () => {
      const current = database
        .prepare('SELECT id,version FROM attachments WHERE ownerId=? AND deletedAt IS NULL')
        .all(context.ownerId) as { id: string; version: number }[]
      if (
        items.length !== current.length ||
        new Set(items.map((row) => row.id)).size !== items.length ||
        items.some(
          (row) => !current.some((old) => old.id === row.id && old.version === row.version)
        )
      )
        throw new BusinessError(409, 'VERSION_CONFLICT', '素材列表已变化，请刷新后排序')
      items.forEach((row, index) =>
        database
          .prepare('UPDATE attachments SET sortIndex=?,version=version+1 WHERE ownerId=? AND id=?')
          .run(index, context.ownerId, row.id)
      )
      return { success: true }
    }
  )
}
