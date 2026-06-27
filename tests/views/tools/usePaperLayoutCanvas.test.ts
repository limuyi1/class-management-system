import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPaperLayoutPointerDelta,
  usePaperLayoutCanvas
} from '@/views/tools/composables/usePaperLayoutCanvas'
import { PagesEnum } from '@/types/Common'
import type { AttachmentRecordType, PaperLayoutSettingsType } from '@/types/Tools'

vi.mock('@/views/tools/services/attachmentService', () => ({
  attachmentToObjectUrl: (attachment: AttachmentRecordType) => `blob:${attachment.id}`
}))

const createSettings = (): PaperLayoutSettingsType => ({
  pageType: PagesEnum.A4,
  orientation: 'portrait',
  columns: 2,
  margin: 10,
  gap: 5
})

const createAttachment = (
  id: string,
  overrides: Partial<AttachmentRecordType> = {}
): AttachmentRecordType => ({
  id,
  name: `${id}.png`,
  mimeType: 'image/png',
  blob: new Blob(['image'], { type: 'image/png' }),
  sortOrder: 0,
  width: 100,
  height: 50,
  size: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

const createCanvas = () =>
  usePaperLayoutCanvas({
    settings: createSettings(),
    previewPanelRef: ref({ clientWidth: 420 } as HTMLElement)
  })

describe('usePaperLayoutCanvas', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('should convert pointer screen pixels into millimeters with preview scale applied', () => {
    const delta = getPaperLayoutPointerDelta(
      { clientX: 196, clientY: 146 },
      { startClientX: 100, startClientY: 50 },
      2
    )

    expect(delta.deltaX).toBeCloseTo(12.7)
    expect(delta.deltaY).toBeCloseTo(12.7)
  })

  it('should add selected attachments to the current page and select the last one', () => {
    const canvas = createCanvas()

    canvas.handleSelectAttachments([createAttachment('a'), createAttachment('b')])

    expect(canvas.canvasItems.value).toHaveLength(2)
    expect(canvas.canvasItems.value.map((item) => [item.attachmentId, item.dataUrl])).toEqual([
      ['a', 'blob:a'],
      ['b', 'blob:b']
    ])
    expect(canvas.selectedItemId.value).toBe(canvas.canvasItems.value[1].id)
    expect(canvas.currentImagesHint.value).toBe('2 张图片 / 1 页')
  })

  it('should move selected image according to pointer movement', () => {
    const canvas = createCanvas()
    canvas.handleSelectAttachments([createAttachment('a')])
    const item = canvas.canvasItems.value[0]

    canvas.startMove({ clientX: 0, clientY: 0 } as PointerEvent, item)
    canvas.handlePointerMove({ clientX: 96, clientY: 96 } as PointerEvent)
    canvas.handlePointerUp()

    expect(item.x).toBeCloseTo(35.4)
    expect(item.documentY).toBeCloseTo(35.4)
    expect(item.pageIndex).toBe(0)
  })

  it('should keep resize ratio and respect minimum width', () => {
    const canvas = createCanvas()
    canvas.handleSelectAttachments([createAttachment('a')])
    const item = canvas.canvasItems.value[0]
    item.width = 30
    item.height = 15

    canvas.startResize(
      {
        clientX: 100,
        clientY: 0,
        stopPropagation: vi.fn()
      } as unknown as PointerEvent,
      item
    )
    canvas.handlePointerMove({ clientX: 0, clientY: 0 } as PointerEvent)

    expect(item.width).toBe(18)
    expect(item.height).toBe(9)
  })

  it('should revoke and clear selected items through the canvas API', () => {
    const canvas = createCanvas()
    canvas.handleSelectAttachments([createAttachment('a'), createAttachment('b')])
    canvas.removeSelectedItem()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b')
    expect(canvas.canvasItems.value.map((item) => item.attachmentId)).toEqual(['a'])
    expect(canvas.selectedItemId.value).toBe('')

    canvas.revokeItemUrls()
    canvas.clearCanvasItems()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a')
    expect(canvas.canvasItems.value).toEqual([])
  })

  it('should fit preview width inside the allowed zoom range', () => {
    const canvas = createCanvas()

    canvas.fitPreviewWidth()

    expect(canvas.previewScale.value).toBeGreaterThanOrEqual(0.35)
    expect(canvas.previewScale.value).toBeLessThanOrEqual(1.4)
    expect(canvas.previewPercent.value).toMatch(/%$/)
  })
})
