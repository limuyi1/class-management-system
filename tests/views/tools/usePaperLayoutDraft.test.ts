import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePaperLayoutDraft } from '@/views/tools/composables/usePaperLayoutDraft'
import { PagesEnum } from '@/types/Common'
import type {
  AttachmentRecordType,
  PaperLayoutCanvasItemType,
  PaperLayoutDraftRecordType,
  PaperLayoutSettingsType
} from '@/types/Tools'

const draftServiceMocks = vi.hoisted(() => ({
  getPaperLayoutDrafts: vi.fn(),
  savePaperLayoutDraft: vi.fn()
}))

const elementPlusMocks = vi.hoisted(() => ({
  prompt: vi.fn(),
  success: vi.fn(),
  warning: vi.fn()
}))

vi.mock('@/views/tools/services/paperLayoutDraftService', () => draftServiceMocks)

vi.mock('element-plus', () => ({
  ElMessage: {
    success: elementPlusMocks.success,
    warning: elementPlusMocks.warning
  },
  ElMessageBox: {
    prompt: elementPlusMocks.prompt
  }
}))

const createSettings = (): PaperLayoutSettingsType => ({
  pageType: PagesEnum.A4,
  orientation: 'portrait',
  columns: 2,
  margin: 10,
  gap: 5
})

const createItem = (
  id: string,
  overrides: Partial<PaperLayoutCanvasItemType> = {}
): PaperLayoutCanvasItemType => ({
  id,
  attachmentId: id,
  name: `${id}.png`,
  blob: new Blob(['image'], { type: 'image/png' }),
  dataUrl: `blob:${id}`,
  mimeType: 'image/png',
  naturalWidth: 100,
  naturalHeight: 50,
  pageIndex: 0,
  x: 10,
  y: 20,
  documentY: 20,
  width: 80,
  height: 40,
  zIndex: 1,
  ...overrides
})

const createDraft = (): PaperLayoutDraftRecordType => ({
  id: 'draft-1',
  name: '草稿一',
  settings: {
    pageType: PagesEnum.A3,
    orientation: 'landscape',
    columns: 3,
    margin: 8,
    gap: 4
  },
  items: [
    {
      id: 'item-b',
      attachmentId: 'b',
      name: 'b.png',
      mimeType: 'image/png',
      blob: new Blob(['b'], { type: 'image/png' }),
      naturalWidth: 100,
      naturalHeight: 100,
      order: 1,
      pageIndex: 1,
      x: 12,
      y: 16,
      width: 40,
      height: 40,
      zIndex: 3
    },
    {
      id: 'item-a',
      attachmentId: 'a',
      name: 'a.png',
      mimeType: 'image/png',
      blob: new Blob(['a'], { type: 'image/png' }),
      naturalWidth: 100,
      naturalHeight: 50,
      order: 0,
      documentY: 220,
      x: 10,
      y: 20,
      width: 60,
      height: 30,
      zIndex: 2
    }
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
})

const createDraftHook = (items = ref<PaperLayoutCanvasItemType[]>([])) => {
  const settings = createSettings()
  const setCanvasItems = vi.fn((nextItems: PaperLayoutCanvasItemType[]) => {
    items.value = nextItems
  })

  return {
    hook: usePaperLayoutDraft({
      settings,
      canvasItems: items,
      pageSize: computed(() => ({ width: 210, height: 297 })),
      toCanvasItem: (attachment: AttachmentRecordType, index: number) =>
        createItem(`new-${attachment.id}`, {
          attachmentId: attachment.id,
          name: attachment.name,
          blob: attachment.blob,
          mimeType: attachment.mimeType,
          naturalWidth: attachment.width,
          naturalHeight: attachment.height,
          zIndex: index + 1
        }),
      revokeItemUrls: vi.fn(),
      setCanvasItems,
      clearSelection: vi.fn()
    }),
    items,
    settings,
    setCanvasItems
  }
}

describe('usePaperLayoutDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draftServiceMocks.getPaperLayoutDrafts.mockResolvedValue([])
  })

  it('should warn instead of saving an empty canvas', async () => {
    const { hook } = createDraftHook()

    await hook.handleSaveDraft()

    expect(elementPlusMocks.warning).toHaveBeenCalledWith('请先加入图片')
    expect(draftServiceMocks.savePaperLayoutDraft).not.toHaveBeenCalled()
  })

  it('should serialize canvas items and update current draft metadata after saving', async () => {
    const { hook, items } = createDraftHook(ref([createItem('a')]))
    elementPlusMocks.prompt.mockResolvedValue({ value: '  新草稿  ' })
    draftServiceMocks.savePaperLayoutDraft.mockResolvedValue({
      id: 'saved-1',
      name: '新草稿'
    })
    draftServiceMocks.getPaperLayoutDrafts.mockResolvedValue([createDraft()])

    await hook.handleSaveDraft()

    expect(draftServiceMocks.savePaperLayoutDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '新草稿',
        items: [
          expect.objectContaining({
            id: items.value[0].id,
            attachmentId: 'a',
            documentY: 20,
            order: 0
          })
        ]
      })
    )
    expect(hook.currentDraftId.value).toBe('saved-1')
    expect(hook.currentDraftName.value).toBe('新草稿')
    expect(hook.draftCount.value).toBe(1)
    expect(elementPlusMocks.success).toHaveBeenCalledWith('草稿已保存')
  })

  it('should restore sorted draft items and normalize missing documentY on open', async () => {
    const { hook, items, settings, setCanvasItems } = createDraftHook(ref([createItem('old')]))
    draftServiceMocks.getPaperLayoutDrafts.mockResolvedValue([createDraft()])

    await hook.handleOpenDraft(createDraft())

    expect(settings.pageType).toBe(PagesEnum.A3)
    expect(settings.orientation).toBe('landscape')
    expect(setCanvasItems).toHaveBeenCalled()
    expect(items.value.map((item) => [item.id, item.attachmentId, item.documentY])).toEqual([
      ['item-a', 'a', 220],
      ['item-b', 'b', 313]
    ])
    expect(hook.currentDraftId.value).toBe('draft-1')
    expect(hook.currentDraftName.value).toBe('草稿一')
    expect(hook.draftCount.value).toBe(1)
    expect(elementPlusMocks.success).toHaveBeenCalledWith('草稿已打开')
  })
})
