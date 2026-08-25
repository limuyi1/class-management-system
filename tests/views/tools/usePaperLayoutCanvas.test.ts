import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPaperLayoutPointerDelta,
  usePaperLayoutCanvas
} from '@/views/tools/composables/usePaperLayoutCanvas'
import { PagesEnum } from '@/types/Common'
import type { AttachmentRecordType, PaperLayoutSettingsType } from '@/types/Tools'

/**
 * usePaperLayoutCanvas 组合式函数测试
 * 测试目标：试卷排版画布（图片的添加、移动、缩放、删除与画布缩放）
 * 覆盖功能：指针像素到毫米的换算、素材添加与选中、拖动与缩放、删除与 URL 回收、预览缩放范围
 */

// 替身素材转 URL 服务，用稳定的 blob 地址避免依赖真实 URL API
vi.mock('@/views/tools/services/attachmentService', () => ({
  attachmentToObjectUrl: (attachment: AttachmentRecordType) => `blob:${attachment.id}`
}))

// 构造默认的试卷排版设置：A4 纵向、自由布局、2 列
const createSettings = (): PaperLayoutSettingsType => ({
  pageType: PagesEnum.A4,
  orientation: 'portrait',
  layoutMode: 'free',
  fitMode: 'width',
  columns: 2,
  margin: 10,
  gap: 5
})

// 构造 100 × 50 的图片素材记录，可用 overrides 覆盖字段
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

// 以默认设置与 420px 宽的预览面板创建画布 hook 实例
const createCanvas = () =>
  usePaperLayoutCanvas({
    settings: createSettings(),
    previewPanelRef: ref({ clientWidth: 420 } as HTMLElement)
  })

// 覆盖画布素材操作的各项交互与换算逻辑
describe('usePaperLayoutCanvas', () => {
  // 拦截 URL 回收，避免 happy-dom 环境下释放假 blob 地址报错
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
