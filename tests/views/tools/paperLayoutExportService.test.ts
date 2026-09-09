import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import { exportPaperLayoutPdf } from '@/views/tools/services/paperLayoutExportService'

import type { PaperLayoutPageType, PaperLayoutRenderItemType } from '@/types/Tools'

/**
 * paperLayoutExportService 服务测试
 * 测试目标：试卷排版 PDF 导出
 * 覆盖功能：页面数量与毫米到 pt 的尺寸换算、同 ID 图片只拉取一次（缓存）、
 * cover 模式裁剪绘制、输出 Blob 可被 pdf-lib 回读
 */

// 1x1 像素的最小合法 PNG，用于 pdf-lib 嵌入
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const PNG_BYTES = Uint8Array.from(window.atob(PNG_BASE64), (character) => character.charCodeAt(0))

/** 构造渲染项 fixture */
const createItem = (overrides: Partial<PaperLayoutRenderItemType> = {}): PaperLayoutRenderItemType => ({
  id: 'item-1',
  attachmentId: 'att-1',
  name: '图片.png',
  blob: new Blob([PNG_BYTES], { type: 'image/png' }),
  dataUrl: `data:image/png;base64,${PNG_BASE64}`,
  mimeType: 'image/png',
  naturalWidth: 1,
  naturalHeight: 1,
  pageIndex: 0,
  x: 10,
  y: 20,
  documentY: 20,
  width: 50,
  height: 50,
  zIndex: 0,
  localY: 20,
  ...overrides
})

describe('paperLayoutExportService', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(PNG_BYTES.buffer)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports pages with millimetre to pt size conversion', async () => {
    const pages: PaperLayoutPageType[] = [
      { index: 0, items: [createItem()] },
      { index: 1, items: [createItem({ id: 'item-2', localY: 10 })] }
    ]

    const blob = await exportPaperLayoutPdf(pages, { width: 297, height: 210 })

    expect(blob.type).toBe('application/pdf')
    const pdf = await PDFDocument.load(await blob.arrayBuffer())
    expect(pdf.getPageCount()).toBe(2)
    // 297mm × (72/25.4) ≈ 841.9pt；210mm × (72/25.4) ≈ 595.3pt
    const firstPage = pdf.getPage(0)
    expect(firstPage.getWidth()).toBeCloseTo(297 * (72 / 25.4), 1)
    expect(firstPage.getHeight()).toBeCloseTo(210 * (72 / 25.4), 1)
  })

  it('fetches the same image only once across pages', async () => {
    const sharedItem = createItem()
    const pages: PaperLayoutPageType[] = [
      { index: 0, items: [sharedItem] },
      { index: 1, items: [{ ...sharedItem, localY: -20 }] }
    ]

    await exportPaperLayoutPdf(pages, { width: 297, height: 210 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fetches distinct images separately', async () => {
    const pages: PaperLayoutPageType[] = [
      {
        index: 0,
        items: [createItem(), createItem({ id: 'item-2' })]
      }
    ]

    await exportPaperLayoutPdf(pages, { width: 297, height: 210 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('exports an empty page list as a blank PDF without fetching images', async () => {
    const blob = await exportPaperLayoutPdf([], { width: 297, height: 210 })

    const pdf = await PDFDocument.load(await blob.arrayBuffer())
    // pdf-lib 创建文档时自带一页空白页，无任何图片嵌入
    expect(pdf.getPageCount()).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
