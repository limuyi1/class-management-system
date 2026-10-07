import { computed, onScopeDispose, reactive, ref } from 'vue'
import { apiRequest } from '@/api/client'
import { createDefaultPaperLayoutSettings } from '@/views/tools/constants/paperLayout'
import { usePaperLayoutCanvas } from '@/views/tools/composables/usePaperLayoutCanvas'
import { exportPaperLayoutPdf } from '@/views/tools/services/paperLayoutExportService'
import { downloadBlob } from '@/utils/downloadUtil'
import type { PagesEnum } from '@/types/Common'
import type { ResourceType } from '@/types/ApiResources'
import type { AttachmentType } from '@/types/ApiAttachments'
import type {
  AttachmentRecordType,
  PaperLayoutSettingsType,
  PaperLayoutCanvasItemType
} from '@/types/Tools'
/** 排版只保存坐标和素材引用；文件从鉴权接口读取，不访问 Dexie 草稿。 */
export function useApiPaper(owner: () => string) {
  const settings = reactive(createDefaultPaperLayoutSettings()),
    previewPanelRef = ref<HTMLElement | null>(null)
  const canvas = usePaperLayoutCanvas({ settings, previewPanelRef })
  const attachmentPage = ref(1),
    attachmentTotal = ref(0)
  const drafts = ref<ResourceType[]>([]),
    attachments = ref<AttachmentType[]>([]),
    selected = ref<string[]>([])
  const current = ref<ResourceType | null>(null),
    name = ref('试卷排版'),
    busy = ref(false),
    baseline = ref('')
  const versions = new Map<string, number>(),
    keys = new Map<string, string>()
  let generation = 0,
    alive = true
  const payload = () => ({
    settings: { ...settings },
    items: canvas.canvasItems.value.map((item) => ({
      id: item.id,
      attachmentId: item.attachmentId,
      attachmentVersion: versions.get(item.id),
      x: item.x,
      y: item.y,
      documentY: item.documentY,
      pageIndex: item.pageIndex,
      width: item.width,
      height: item.height,
      zIndex: item.zIndex
    }))
  })
  const hasDraft = computed(
    () => JSON.stringify({ name: name.value, ...payload() }) !== baseline.value
  )
  function reset(): void {
    generation++
    canvas.revokeItemUrls()
    canvas.clearCanvasItems()
    versions.clear()
    keys.clear()
    current.value = null
    selected.value = []
    name.value = '试卷排版'
    Object.assign(settings, createDefaultPaperLayoutSettings())
    baseline.value = JSON.stringify({ name: name.value, ...payload() })
  }
  function active(scope: string, epoch: number): boolean {
    return alive && owner() === scope && generation === epoch
  }
  async function load(): Promise<void> {
    const scope = owner(),
      epoch = generation
    const [papers, files, preferences] = await Promise.all([
      apiRequest<{ items: ResourceType[] }>('/resources?kind=paper', { ownerId: scope }),
      apiRequest<{ items: AttachmentType[]; total: number }>(
        `/attachments?offset=${(attachmentPage.value - 1) * 50}`,
        { ownerId: scope }
      ),
      apiRequest<{ items: ResourceType[] }>('/resources?kind=settings', { ownerId: scope })
    ])
    if (active(scope, epoch)) {
      drafts.value = papers.items
      attachments.value = files.items
      attachmentTotal.value = files.total
      if (!current.value && !hasDraft.value && preferences.items[0]?.content.paperType) {
        settings.pageType = String(preferences.items[0].content.paperType) as PagesEnum
        baseline.value = JSON.stringify({ name: name.value, ...payload() })
      }
    }
  }
  async function record(file: AttachmentType, blob: Blob): Promise<AttachmentRecordType> {
    return {
      ...file,
      blob,
      sortOrder: 0,
      createdAt: new Date(file.createdAt).toISOString(),
      updatedAt: new Date(file.updatedAt).toISOString()
    }
  }
  async function add(): Promise<void> {
    if (busy.value) return
    const scope = owner(),
      epoch = generation
    busy.value = true
    try {
      for (const id of selected.value) {
        const file = attachments.value.find((row) => row.id === id)
        if (!file) continue
        const blob = await apiRequest<Blob>(`/attachments/${id}/content?version=${file.version}`, {
          ownerId: scope,
          responseType: 'blob'
        })
        if (!active(scope, epoch)) return
        const item = canvas.toCanvasItem(await record(file, blob), canvas.canvasItems.value.length)
        versions.set(item.id, file.version)
        canvas.setCanvasItems([...canvas.canvasItems.value, item])
      }
      canvas.autoArrange()
      selected.value = []
    } finally {
      busy.value = false
    }
  }
  async function save(): Promise<void> {
    if (busy.value) return
    const scope = owner(),
      epoch = generation
    busy.value = true
    try {
      const id = current.value?.id || crypto.randomUUID(),
        body = {
          workspaceId: null,
          name: name.value,
          content: payload(),
          version: current.value?.version || 0
        }
      const fingerprint = JSON.stringify([scope, current.value?.id || 'new', body])
      let key = keys.get(fingerprint)
      if (!key) {
        key = crypto.randomUUID()
        keys.set(fingerprint, key)
      }
      // 新建 UUID 随重试保留，网络响应丢失时不能另建草稿。
      const identity = keys.get(`${fingerprint}:id`) || id
      keys.set(`${fingerprint}:id`, identity)
      const result = await apiRequest<ResourceType>(`/resources/paper/${identity}`, {
        ownerId: scope,
        method: 'PUT',
        body,
        idempotencyKey: key
      })
      if (active(scope, epoch)) {
        current.value = result
        baseline.value = JSON.stringify({ name: name.value, ...payload() })
        await load()
      }
    } finally {
      busy.value = false
    }
  }
  async function open(draft: ResourceType): Promise<void> {
    if (busy.value) return
    reset()
    const scope = owner(),
      epoch = generation
    busy.value = true
    const next: PaperLayoutCanvasItemType[] = []
    let published = false
    try {
      Object.assign(settings, draft.content.settings as unknown as PaperLayoutSettingsType)
      const items = draft.content.items as {
        id: string
        attachmentId: string
        attachmentVersion: number
        x: number
        y: number
        documentY: number
        pageIndex: number
        width: number
        height: number
        zIndex: number
      }[]
      for (const item of items) {
        const blob = await apiRequest<Blob>(
          `/papers/${draft.id}/items/${encodeURIComponent(item.id)}/content`,
          { ownerId: scope, responseType: 'blob' }
        )
        if (!active(scope, epoch)) return
        const image = await createImageBitmap(blob)
        const metadata: AttachmentType = {
          id: item.attachmentId,
          name: '试卷图片',
          mimeType: blob.type as 'image/png' | 'image/jpeg',
          width: image.width,
          height: image.height,
          size: blob.size,
          version: item.attachmentVersion,
          createdAt: draft.updatedAt,
          updatedAt: draft.updatedAt
        }
        image.close()
        const built = canvas.toCanvasItem(await record(metadata, blob), next.length)
        next.push({ ...built, ...item })
        versions.set(item.id, item.attachmentVersion)
      }
      if (active(scope, epoch)) {
        canvas.setCanvasItems(next)
        published = true
        current.value = draft
        name.value = draft.name
        baseline.value = JSON.stringify({ name: name.value, ...payload() })
      }
    } finally {
      if (!published) next.forEach((item) => URL.revokeObjectURL(item.dataUrl))
      busy.value = false
    }
  }
  async function remove(draft: ResourceType): Promise<void> {
    busy.value = true
    try {
      await apiRequest(`/resources/paper/${draft.id}`, {
        ownerId: owner(),
        method: 'DELETE',
        body: { version: draft.version },
        idempotencyKey: crypto.randomUUID()
      })
      if (current.value?.id === draft.id) reset()
      await load()
    } finally {
      busy.value = false
    }
  }
  async function exportPdf(): Promise<void> {
    if (!current.value || hasDraft.value) throw new Error('请先保存排版草稿')
    const scope = owner(),
      epoch = generation,
      id = current.value.id,
      version = current.value.version
    busy.value = true
    try {
      const blob = await exportPaperLayoutPdf(canvas.pages.value, canvas.pageSize.value)
      const rows = await apiRequest<{ items: ResourceType[] }>('/resources?kind=paper', {
        ownerId: scope
      })
      if (!active(scope, epoch)) return
      if (!rows.items.some((row) => row.id === id && row.version === version))
        throw new Error('草稿已变化或删除，请重新打开')
      await downloadBlob(blob, `${name.value}.pdf`)
    } finally {
      busy.value = false
    }
  }
  reset()
  onScopeDispose(() => {
    alive = false
    reset()
  })
  return {
    attachmentPage,
    attachmentTotal,
    settings,
    previewPanelRef,
    canvas,
    drafts,
    attachments,
    selected,
    current,
    name,
    busy,
    hasDraft,
    reset,
    load,
    add,
    save,
    open,
    remove,
    exportPdf
  }
}
