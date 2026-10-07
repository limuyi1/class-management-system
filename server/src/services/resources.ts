import { validateResource } from './resourceValidation.js'
import { transaction } from '../db/migrate.js'
import { getWorkspace } from '../repositories/workspaces.js'
import { mutate, validateContext } from './mutations.js'
import { audit } from './accounts.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'

export interface ResourceType {
  id: string
  kind: 'paper' | 'tags' | 'settings'
  workspaceId: string | null
  name: string
  content: Record<string, unknown>
  version: number
  updatedAt: number
}
interface ResourceRowType extends Omit<ResourceType, 'content'> {
  contentJson: string
  deletedAt: number | null
}
const dto = (row: ResourceRowType): ResourceType => ({
  id: row.id,
  kind: row.kind,
  workspaceId: row.workspaceId,
  name: row.name,
  content: JSON.parse(row.contentJson) as Record<string, unknown>,
  version: row.version,
  updatedAt: row.updatedAt
})
/** 列表与审计绑定明确 owner；软删除和已删除学期不再显示。 */
export function listResources(
  database: DatabaseType,
  context: AccessContextType,
  kind: ResourceType['kind'],
  workspaceId: string | null,
  requestId: string
): ResourceType[] {
  return transaction(database, () => {
    validateContext(database, context)
    if (workspaceId) getWorkspace(database, context.ownerId, workspaceId)
    const rows = database
      .prepare(
        'SELECT * FROM business_resources WHERE ownerId=? AND kind=? AND workspaceId IS ? AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1000'
      )
      .all(context.ownerId, kind, workspaceId) as ResourceRowType[]
    audit(database, context.actor.id, context.ownerId, 'RESOURCE_READ', kind, requestId)
    return rows.map(dto)
  })
}
/** 文档 CAS 与幂等，纸张同时捕获不可变素材版本，旋转或软删除不改变已有草稿。 */
export function saveResource(
  database: DatabaseType,
  context: AccessContextType,
  input: Omit<ResourceType, 'updatedAt'>,
  key: string,
  requestId: string
): ResourceType {
  return mutate(
    database,
    context,
    'RESOURCE_SAVE',
    `${input.kind}:${input.id}`,
    input,
    key,
    requestId,
    () => {
      validateResource(database, context, input)
      const old = database
        .prepare('SELECT * FROM business_resources WHERE ownerId=? AND kind=? AND id=?')
        .get(context.ownerId, input.kind, input.id) as ResourceRowType | undefined
      if (
        old?.deletedAt ||
        (old?.version || 0) !== input.version ||
        (old && old.workspaceId !== input.workspaceId)
      )
        throw new BusinessError(409, 'VERSION_CONFLICT', '文档已变化或删除，请刷新')
      database
        .prepare(
          `INSERT INTO business_resources VALUES(?,?,?,?,?,?,?,NULL,?) ON CONFLICT(ownerId,kind,id) DO UPDATE SET name=excluded.name,contentJson=excluded.contentJson,version=excluded.version,updatedAt=excluded.updatedAt`
        )
        .run(
          context.ownerId,
          input.kind,
          input.id,
          input.workspaceId,
          input.name.trim(),
          JSON.stringify(input.content),
          input.version + 1,
          Date.now()
        )
      if (input.kind === 'paper') {
        const previousFiles = database
          .prepare('SELECT itemId,hash,mimeType FROM paper_files WHERE ownerId=? AND paperId=?')
          .all(context.ownerId, input.id) as { itemId: string; hash: string; mimeType: string }[]
        database
          .prepare('DELETE FROM paper_files WHERE ownerId=? AND paperId=?')
          .run(context.ownerId, input.id)
        for (const value of input.content.items as Record<string, unknown>[]) {
          const updatedFile = database
            .prepare(
              'SELECT hash,mimeType FROM attachments WHERE ownerId=? AND id=? AND version=? AND deletedAt IS NULL'
            )
            .get(context.ownerId, String(value.attachmentId), Number(value.attachmentVersion)) as
            | {
                hash: string
                mimeType: string
              }
            | undefined
          const previous = old
            ? (JSON.parse(old.contentJson).items as Record<string, unknown>[]).find(
                (item) =>
                  item.id === value.id &&
                  item.attachmentId === value.attachmentId &&
                  item.attachmentVersion === value.attachmentVersion
              )
            : undefined
          const file = previous
            ? previousFiles.find((row) => row.itemId === value.id) || updatedFile
            : updatedFile
          if (!file) throw new BusinessError(409, 'ATTACHMENT_CHANGED', '打印图片快照已变化')
          database
            .prepare('INSERT INTO paper_files VALUES(?,?,?,?,?)')
            .run(context.ownerId, input.id, String(value.id), file.hash, file.mimeType)
        }
      }
      return dto(
        database
          .prepare('SELECT * FROM business_resources WHERE ownerId=? AND kind=? AND id=?')
          .get(context.ownerId, input.kind, input.id) as ResourceRowType
      )
    }
  )
}
/** 删除保留文档和图片快照，不立即清理文件。 */
export function deleteResource(
  database: DatabaseType,
  context: AccessContextType,
  kind: ResourceType['kind'],
  id: string,
  version: number,
  key: string,
  requestId: string
) {
  return mutate(
    database,
    context,
    'RESOURCE_DELETE',
    `${kind}:${id}`,
    { version },
    key,
    requestId,
    () => {
      const result = database
        .prepare(
          'UPDATE business_resources SET deletedAt=?,version=version+1 WHERE ownerId=? AND kind=? AND id=? AND version=? AND deletedAt IS NULL'
        )
        .run(Date.now(), context.ownerId, kind, id, version)
      if (!result.changes) throw new BusinessError(409, 'VERSION_CONFLICT', '文档已变化或不存在')
      return { success: true }
    }
  )
}
