/**
 * 测试图片模式的座位表 PDF 导出（seatingChartExportUtil.createSeatingChartPdf）。
 * 覆盖：mock pdf-lib 验证渲染后的 PNG 按所选纸张页面嵌入并铺满绘制。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PagesEnum } from '@/types/Common'

// 提前构造 pdf-lib 的 mock 对象，记录页面创建、图片嵌入与绘制调用
const pdfMocks = vi.hoisted(() => {
  const drawImage = vi.fn()
  const page = { drawImage }
  const image = { type: 'png' }
  const doc = {
    embedPng: vi.fn(async () => image),
    addPage: vi.fn(() => page),
    save: vi.fn(async () => new Uint8Array([1, 2, 3]))
  }

  return {
    addPage: doc.addPage,
    create: vi.fn(async () => doc),
    doc,
    drawImage,
    image
  }
})

// 用 mock 替换 PDF 库与 DOM 截图，避免真实渲染
vi.mock('pdf-lib', () => ({
  PDFDocument: { create: pdfMocks.create }
}))
vi.mock('dom-to-image', () => ({ default: { toPng: vi.fn() } }))

// 图片模式座位表 PDF 导出测试组
describe('image-based seating chart PDF export', () => {
  // 每个用例前清空 mock 调用记录
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('embeds the rendered PNG across the selected paper page', async () => {
    const { createSeatingChartPdf } = await import('@/utils/seating-chart/seatingChartExportUtil')
    const imageBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const blob = await createSeatingChartPdf({
      imageBlob,
      pageType: PagesEnum.A4,
      orientation: 'landscape'
    })

    expect(blob.type).toBe('application/pdf')
    expect(pdfMocks.doc.embedPng).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
    expect(pdfMocks.addPage).toHaveBeenCalledWith([841.89, 595.28])
    expect(pdfMocks.drawImage).toHaveBeenCalledWith(pdfMocks.image, {
      x: 0,
      y: 0,
      width: 841.89,
      height: 595.28
    })
    expect(pdfMocks.doc).not.toHaveProperty('embedFont')
    expect(pdfMocks.doc).not.toHaveProperty('registerFontkit')
  })
})
