import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { apiRequest, ApiRequestError } from '@/api/client'
import type { AttachmentType, AttachmentListType } from '@/types/ApiAttachments'

/** 元数据分页读取，图片按需鉴权获取；切换账号时清除 Blob URL 与上传草稿。 */
export function useApiAttachments(owner: () => string) {
  const items = shallowRef<AttachmentType[]>([])
  const total = ref(0),
    page = ref(1),
    loading = ref(false),
    busy = ref(false)
  const queue = shallowRef<File[]>([])
  const errorMessage = ref(''),
    previewUrl = ref(''),
    previewRecord = shallowRef<AttachmentType | null>(null)
  const hasDraft = computed(() => queue.value.length > 0)
  let alive = true,
    generation = 0
  let controller = new AbortController()
  const uploads = new WeakMap<File, { id: string; key: string }>()
  const keys = new Map<string, string>()
  function closePreview(): void {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
    previewRecord.value = null
  }
  function reset(): void {
    generation++
    controller.abort()
    controller = new AbortController()
    items.value = []
    total.value = 0
    page.value = 1
    queue.value = []
    errorMessage.value = ''
    loading.value = false
    closePreview()
    keys.clear()
  }
  function clearDenied(error: unknown): void {
    if (error instanceof ApiRequestError && [401, 403].includes(error.status)) {
      closePreview()
      items.value = []
      total.value = 0
      queue.value = []
    }
  }
  async function load(): Promise<void> {
    const scope = owner(),
      current = generation,
      selectedPage = page.value
    loading.value = true
    try {
      const data = await apiRequest<AttachmentListType>(
        `/attachments?offset=${(selectedPage - 1) * 50}`,
        { ownerId: scope, signal: controller.signal }
      )
      if (!alive || current !== generation || scope !== owner() || selectedPage !== page.value)
        return
      items.value = data.items
      total.value = data.total
      errorMessage.value = ''
    } catch (error) {
      if (current === generation) clearDenied(error)
      if (current === generation)
        errorMessage.value = error instanceof Error ? error.message : '读取素材失败'
      throw error
    } finally {
      if (current === generation) loading.value = false
    }
  }
  function select(files: File[]): void {
    if (busy.value) throw new Error('请等待当前操作完成')
    if (files.length > 10) throw new Error('每批最多上传 10 张图片')
    if (
      files.some(
        (file) =>
          !['image/png', 'image/jpeg'].includes(file.type) ||
          file.size === 0 ||
          file.size > 8 * 1024 * 1024
      )
    )
      throw new Error('仅支持 PNG/JPEG，单张最大 8 MB')
    queue.value = files
  }
  async function upload(): Promise<void> {
    if (busy.value) throw new Error('请等待当前操作完成')
    const scope = owner(),
      current = generation
    busy.value = true
    try {
      for (const file of [...queue.value]) {
        if (!alive || scope !== owner() || current !== generation) return
        let identity = uploads.get(file)
        if (!identity) {
          identity = { id: crypto.randomUUID(), key: crypto.randomUUID() }
          uploads.set(file, identity)
        }
        // 重试保留 File、方案 UUID 与幂等键，不将图片转成巨大的 Base64 JSON。
        await apiRequest(`/attachments/${identity.id}`, {
          ownerId: scope,
          method: 'PUT',
          body: file,
          fileName: file.name,
          expectedVersion: 0,
          idempotencyKey: identity.key,
          signal: controller.signal
        })
        if (!alive || scope !== owner() || current !== generation) return
        queue.value = queue.value.filter((row) => row !== file)
      }
      await load()
    } catch (error) {
      if (current === generation) clearDenied(error)
      throw error
    } finally {
      busy.value = false
    }
  }
  async function edit(
    record: AttachmentType,
    method: 'PATCH' | 'DELETE',
    name?: string
  ): Promise<void> {
    if (busy.value) throw new Error('请等待当前操作完成')
    const scope = owner(),
      current = generation
    const body = { version: record.version, ...(method === 'PATCH' ? { name } : {}) }
    const fingerprint = JSON.stringify([scope, record.id, method, body])
    if (!keys.has(fingerprint)) keys.set(fingerprint, crypto.randomUUID())
    busy.value = true
    try {
      await apiRequest(`/attachments/${record.id}`, {
        method,
        ownerId: scope,
        body,
        idempotencyKey: keys.get(fingerprint),
        signal: controller.signal
      })
      if (!alive || current !== generation || scope !== owner()) return
      closePreview()
      await load()
    } catch (error) {
      if (current === generation) clearDenied(error)
      throw error
    } finally {
      busy.value = false
    }
  }
  async function content(record: AttachmentType, download = false): Promise<void> {
    if (busy.value) throw new Error('请等待当前操作完成')
    const scope = owner(),
      current = generation
    busy.value = true
    try {
      const blob = await apiRequest<Blob>(
        `/attachments/${record.id}/content?version=${record.version}`,
        { ownerId: scope, responseType: 'blob', signal: controller.signal }
      )
      if (!alive || current !== generation || scope !== owner()) return
      const fresh = await apiRequest<AttachmentType>(`/attachments/${record.id}`, {
        ownerId: scope,
        signal: controller.signal
      })
      if (!alive || current !== generation || scope !== owner()) return
      if (fresh.version !== record.version) throw new Error('素材已变更，请刷新列表')
      if (download) {
        const url = URL.createObjectURL(blob),
          link = document.createElement('a')
        try {
          link.href = url
          link.download = record.name
          link.click()
        } finally {
          URL.revokeObjectURL(url)
        }
      } else {
        closePreview()
        previewUrl.value = URL.createObjectURL(blob)
        previewRecord.value = record
      }
    } catch (error) {
      if (current === generation) clearDenied(error)
      throw error
    } finally {
      busy.value = false
    }
  }
  onScopeDispose(() => {
    alive = false
    reset()
  })
  return {
    items,
    total,
    page,
    loading,
    busy,
    queue,
    hasDraft,
    errorMessage,
    previewUrl,
    previewRecord,
    reset,
    closePreview,
    load,
    select,
    upload,
    edit,
    content
  }
}
