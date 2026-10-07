import { transaction } from '../db/migrate.js'
import { audit } from './accounts.js'
import { mutate, validateContext } from './mutations.js'
import { BusinessError } from './errors.js'
import {
  inspectAttachment,
  OWNER_ATTACHMENT_BYTES,
  readAttachmentFile,
  storeAttachment
} from './attachmentFiles.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type {
  AttachmentType,
  AttachmentListType
} from '../../../packages/shared/src/Attachments.js'

interface AttachmentRowType extends AttachmentType {
  ownerId: string
  sortIndex: number
  hash: string
  deletedAt: number | null
}
const dto = (row: AttachmentRowType): AttachmentType => ({
  id: row.id,
  sortIndex: row.sortIndex,
  name: row.name,
  mimeType: row.mimeType,
  size: row.size,
  width: row.width,
  height: row.height,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
})
function get(database: DatabaseType, ownerId: string, id: string): AttachmentRowType {
  const row = database
    .prepare('SELECT * FROM attachments WHERE id=? AND ownerId=? AND deletedAt IS NULL')
    .get(id, ownerId) as AttachmentRowType | undefined
  if (!row) throw new BusinessError(404, 'NOT_FOUND', '素材不存在或已删除')
  return row
}
function name(value: string): string {
  if (
    !value.trim() ||
    value.length > 200 ||
    /[\\/]/.test(value) ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new BusinessError(400, 'INVALID_FILENAME', '文件名不能为空，不能包含路径或控制字符')
  return value.trim()
}
/** 账号素材跨班级共用，列表分页只返回元数据，不批量传输图片。 */
export function listAttachments(
  database: DatabaseType,
  context: AccessContextType,
  offset: number,
  requestId: string
): AttachmentListType {
  return transaction(database, () => {
    validateContext(database, context)
    const rows = database
      .prepare(
        'SELECT * FROM attachments WHERE ownerId=? AND deletedAt IS NULL ORDER BY sortIndex,id LIMIT 50 OFFSET ?'
      )
      .all(context.ownerId, offset) as AttachmentRowType[]
    const total = database
      .prepare('SELECT COUNT(*) AS count FROM attachments WHERE ownerId=? AND deletedAt IS NULL')
      .get(context.ownerId) as { count: number }
    audit(
      database,
      context.actor.id,
      context.ownerId,
      'ATTACHMENTS_READ',
      context.ownerId,
      requestId
    )
    return { items: rows.map(dto), total: total.count }
  })
}
/** 内容摘要参与幂等校验；先确认权限、版本与配额，再写不可变文件和元数据。 */
export function uploadAttachment(
  database: DatabaseType,
  directory: string,
  context: AccessContextType,
  id: string,
  input: { name: string; version: number; mimeType: string; buffer: Buffer },
  key: string,
  requestId: string
): AttachmentType {
  const file = inspectAttachment(input.buffer, input.mimeType)
  const filename = name(input.name)
  return mutate(
    database,
    context,
    'ATTACHMENT_UPLOAD',
    id,
    { ...file, name: filename, version: input.version },
    key,
    requestId,
    () => {
      const current = database
        .prepare('SELECT * FROM attachments WHERE id=? AND ownerId=?')
        .get(id, context.ownerId) as AttachmentRowType | undefined
      if (current?.deletedAt)
        throw new BusinessError(409, 'ATTACHMENT_DELETED', '素材已删除，不能覆盖')
      if ((current?.version || 0) !== input.version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '素材已被其他设备修改，请刷新后重试')
      if (!current && database.prepare('SELECT id FROM attachments WHERE id=?').get(id))
        throw new BusinessError(409, 'ID_CONFLICT', '素材标识已使用')
      const exists = database
        .prepare('SELECT hash FROM attachment_blobs WHERE ownerId=? AND hash=?')
        .get(context.ownerId, file.hash)
      const usage = database
        .prepare('SELECT COALESCE(SUM(size),0) AS size FROM attachment_blobs WHERE ownerId=?')
        .get(context.ownerId) as { size: number }
      if (!exists && usage.size + file.size > OWNER_ATTACHMENT_BYTES)
        throw new BusinessError(
          413,
          'ATTACHMENT_QUOTA',
          '账号素材累计占用超过 512 MB，请联系管理员处理'
        )
      storeAttachment(directory, context.ownerId, file.hash, input.buffer)
      const now = Date.now()
      if (!exists)
        database
          .prepare('INSERT INTO attachment_blobs VALUES(?,?,?,?)')
          .run(context.ownerId, file.hash, file.size, now)
      if (current)
        database
          .prepare(
            'UPDATE attachments SET name=?,mimeType=?,size=?,width=?,height=?,hash=?,version=version+1,updatedAt=? WHERE id=? AND ownerId=? AND version=?'
          )
          .run(
            filename,
            file.mimeType,
            file.size,
            file.width,
            file.height,
            file.hash,
            now,
            id,
            context.ownerId,
            input.version
          )
      else
        database
          .prepare('INSERT INTO attachments(id,ownerId,name,mimeType,size,width,height,hash,version,createdAt,updatedAt,deletedAt) VALUES(?,?,?,?,?,?,?, ?,1,?,?,NULL)')
          .run(
            id,
            context.ownerId,
            filename,
            file.mimeType,
            file.size,
            file.width,
            file.height,
            file.hash,
            now,
            now
          )
      if (!current) database.prepare('UPDATE attachments SET sortIndex=(SELECT COALESCE(MAX(sortIndex),0)+1 FROM attachments WHERE ownerId=?) WHERE id=? AND ownerId=?').run(context.ownerId,id,context.ownerId)
      return dto(get(database, context.ownerId, id))
    }
  )
}
/** 名称修改和软删除都要求版本，不修改任何文件内容或其他账号的素材。 */
export function editAttachment(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  input: { version: number; name?: string; delete?: boolean },
  key: string,
  requestId: string
): AttachmentType | { deleted: true } {
  return mutate(
    database,
    context,
    input.delete ? 'ATTACHMENT_DELETE' : 'ATTACHMENT_RENAME',
    id,
    input,
    key,
    requestId,
    () => {
      const current = get(database, context.ownerId, id)
      if (current.version !== input.version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '素材已被其他设备修改')
      const now = Date.now()
      if (input.delete) {
        database
          .prepare(
            'UPDATE attachments SET deletedAt=?,updatedAt=?,version=version+1 WHERE id=? AND ownerId=? AND version=?'
          )
          .run(now, now, id, context.ownerId, input.version)
        return { deleted: true }
      }
      database
        .prepare(
          'UPDATE attachments SET name=?,updatedAt=?,version=version+1 WHERE id=? AND ownerId=? AND version=?'
        )
        .run(name(input.name || ''), now, id, context.ownerId, input.version)
      return dto(get(database, context.ownerId, id))
    }
  )
}
/** 二进制下载重新验证账号与代管资格，支持指定版本防止预览与保存之间悄悄换图。 */
export function downloadAttachment(
  database: DatabaseType,
  directory: string,
  context: AccessContextType,
  id: string,
  version: number,
  requestId: string
): { record: AttachmentType; buffer: Buffer } {
  return transaction(database, () => {
    validateContext(database, context)
    const row = get(database, context.ownerId, id)
    if (row.version !== version)
      throw new BusinessError(409, 'VERSION_CONFLICT', '素材已变更，请刷新列表')
    const buffer = readAttachmentFile(directory, context.ownerId, row.hash)
    audit(database, context.actor.id, context.ownerId, 'ATTACHMENT_DOWNLOAD', id, requestId)
    return { record: dto(row), buffer }
  })
}

/** 文件传输结束后可再次读取少量元数据，检查撤权、删除或版本变化。 */
export function attachmentMetadata(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  requestId: string
): AttachmentType {
  return transaction(database, () => {
    validateContext(database, context)
    const record = dto(get(database, context.ownerId, id))
    audit(database, context.actor.id, context.ownerId, 'ATTACHMENT_METADATA_READ', id, requestId)
    return record
  })
}
