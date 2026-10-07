import { apiRequest } from '@/api/client'
import type { AttachmentType, AttachmentListType } from '@/types/ApiAttachments'
import type { ResourceType } from '@/types/ApiResources'
import type {
  AttachmentRecordType,
  PaperLayoutDraftRecordType,
  PaperLayoutDraftItemType,
  PaperLayoutSettingsType
} from '@/types/Tools'

const metadata = new Map<string, AttachmentType>(),
  papers = new Map<string, ResourceType>()
let versions = new WeakMap<Blob, number>()
let uploads = new WeakMap<Blob, { id: string; key: string; version: number; name: string }>()
const keys = new Map<string, string>()
const mutationKey = (value: unknown): string => {
  const fingerprint = JSON.stringify(value)
  if (!keys.has(fingerprint)) keys.set(fingerprint, crypto.randomUUID())
  return keys.get(fingerprint)!
}
/** 账号切换清理素材版本缓存，Blob 不持久化到浏览器数据库。 */
export function clearServerAssets(): void {
  metadata.clear()
  papers.clear()
  keys.clear()
  versions = new WeakMap()
  uploads = new WeakMap()
}
/** 有界分页读取素材，旧素材界面仍使用原记录类型和裁剪交互。 */
export async function listServerAttachments(): Promise<AttachmentType[]> {
  const items: AttachmentType[] = []
  for (let offset = 0; ; offset += 50) {
    const result = await apiRequest<AttachmentListType>(`/attachments?offset=${offset}`)
    result.items.forEach((item) => metadata.set(item.id, item))
    items.push(...result.items)
    if (items.length >= result.total || !result.items.length) break
  }
  return items
}
async function record(item: AttachmentType, blob?: Blob): Promise<AttachmentRecordType> {
  blob ||= await apiRequest<Blob>(`/attachments/${item.id}/content?version=${item.version}`, {
    responseType: 'blob'
  })
  versions.set(blob, item.version)
  return {
    ...item,
    blob,
    sortOrder: Number((item as AttachmentType & { sortOrder?: number }).sortOrder || 0),
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString()
  }
}
/** 读取素材内容需鉴权，所有二进制只放当前页面内存。 */
export async function serverAttachments(): Promise<AttachmentRecordType[]> {
  return Promise.all(
    (await listServerAttachments()).map(async (item, index) => ({
      ...(await record(item)),
      sortOrder: index
    }))
  )
}
/** 图片上传/裁剪 CAS 保留原请求键，响应丢失重试不重复创建。 */
export async function saveServerAttachment(
  value: AttachmentRecordType
): Promise<AttachmentRecordType> {
  const old = metadata.get(value.id)
  let identity = uploads.get(value.blob)
  if (!identity || identity.name !== value.name) {
    identity = {
      id: old?.id || (/^[0-9a-f-]{36}$/i.test(value.id) ? value.id : crypto.randomUUID()),
      key: crypto.randomUUID(),
      version: old?.version || 0,
      name: value.name
    }
    uploads.set(value.blob, identity)
  }
  const item = await apiRequest<AttachmentType>(`/attachments/${identity.id}`, {
    method: 'PUT',
    body: value.blob,
    fileName: value.name,
    expectedVersion: identity.version,
    idempotencyKey: identity.key
  })
  metadata.set(item.id, item)
  return record(item, value.blob)
}
/** 名称及删除只修改元数据，服务器保留被历史草稿引用的图片。 */
export async function editServerAttachment(id: string, name?: string): Promise<void> {
  const old = metadata.get(id) || (await apiRequest<AttachmentType>(`/attachments/${id}`))
  const method = name === undefined ? 'DELETE' : 'PATCH',
    body = { version: old.version, ...(name === undefined ? {} : { name }) }
  const result = await apiRequest<AttachmentType>(`/attachments/${id}`, {
    method,
    body,
    idempotencyKey: mutationKey([id, method, body])
  })
  if (name === undefined) metadata.delete(id)
  else metadata.set(id, result)
}
/** 通过原子排序接口提交全序及版本，拖拽排序不上传图片。 */
export async function reorderServerAttachments(ids: string[]): Promise<void> {
  const current = [...metadata.values()]
  const body = {
    items: ids.map((id) => {
      const row = current.find((value) => value.id === id)
      if (!row) throw new Error('素材已变化，请刷新')
      return { id, version: row.version }
    })
  }
  await apiRequest('/attachments/order', { method: 'PUT', body, idempotencyKey: mutationKey(body) })
}
/** 草稿列表恢复不可变图片快照，不从当前素材替换历史图片。 */
export async function serverPaperDrafts(): Promise<PaperLayoutDraftRecordType[]> {
  const result = await apiRequest<{ items: ResourceType[] }>('/resources?kind=paper')
  return Promise.all(
    result.items.map(async (row) => {
      papers.set(row.id, row)
      const items = await Promise.all(
        (row.content.items as Record<string, unknown>[]).map(
          async (item, order): Promise<PaperLayoutDraftItemType> => {
            const blob = await apiRequest<Blob>(
              `/papers/${row.id}/items/${encodeURIComponent(String(item.id))}/content`,
              { responseType: 'blob' }
            )
            versions.set(blob, Number(item.attachmentVersion))
            const image = await createImageBitmap(blob)
            const naturalWidth = image.width,
              naturalHeight = image.height
            image.close()
            return {
              ...item,
              id: String(item.id),
              attachmentId: String(item.attachmentId),
              name: '试卷图片',
              mimeType: blob.type,
              blob,
              naturalWidth,
              naturalHeight,
              order,
              pageIndex: Number(item.pageIndex),
              x: Number(item.x),
              y: Number(item.y),
              documentY: Number(item.documentY),
              width: Number(item.width),
              height: Number(item.height),
              zIndex: Number(item.zIndex)
            }
          }
        )
      )
      return {
        id: row.id,
        name: row.name,
        settings: row.content.settings as unknown as PaperLayoutSettingsType,
        items,
        createdAt: new Date(row.updatedAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString()
      }
    })
  )
}
/** 只保存素材引用和布局，临时上传图片先成为受保护素材，再捕获版本。 */
export async function saveServerPaper(options: {
  id?: string
  name: string
  settings: PaperLayoutSettingsType
  items: PaperLayoutDraftItemType[]
}): Promise<PaperLayoutDraftRecordType> {
  const contentItems: Record<string, unknown>[] = []
  for (const item of options.items) {
    let attachmentId = item.attachmentId,
      version = versions.get(item.blob)
    if (!version) {
      const saved = await saveServerAttachment({
        id: attachmentId,
        name: item.name,
        blob: item.blob,
        mimeType: item.mimeType,
        width: item.naturalWidth,
        height: item.naturalHeight,
        size: item.blob.size,
        sortOrder: item.order || 0,
        createdAt: '',
        updatedAt: ''
      })
      attachmentId = saved.id
      version = versions.get(saved.blob)
    }
    contentItems.push({
      id: item.id,
      attachmentId,
      attachmentVersion: version,
      x: item.x,
      y: item.y,
      documentY: item.documentY,
      pageIndex: item.pageIndex,
      width: item.width,
      height: item.height,
      zIndex: item.zIndex
    })
  }
  const old = options.id ? papers.get(options.id) : undefined
  const body = {
    workspaceId: null,
    name: options.name,
    version: old?.version || 0,
    content: { settings: options.settings, items: contentItems }
  }
  const fingerprint = JSON.stringify([options.id, body]),
    idKey = `${fingerprint}:id`
  if (!keys.has(idKey)) keys.set(idKey, options.id || crypto.randomUUID())
  const id = keys.get(idKey)!
  const row = await apiRequest<ResourceType>(`/resources/paper/${id}`, {
    method: 'PUT',
    body,
    idempotencyKey: mutationKey(fingerprint)
  })
  papers.set(id, row)
  return {
    ...options,
    id,
    createdAt: new Date(row.updatedAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString()
  }
}
/** 删除草稿保持版本和幂等，图片快照由服务器管理。 */
export async function deleteServerPaper(id: string): Promise<void> {
  const row = papers.get(id)
  if (!row) throw new Error('草稿不存在，请刷新')
  const body = { version: row.version }
  await apiRequest(`/resources/paper/${id}`, {
    method: 'DELETE',
    body,
    idempotencyKey: mutationKey([id, body])
  })
  papers.delete(id)
}
