/**
 * 测试 pdfUtil 的 exportPDF。
 * 覆盖：DOM 元素导出为 PDF 的渲染链路、A4 纸张尺寸换算、渲染失败时的错误返回。
 * 通过 mock pdf-lib、dom-to-image 与页面尺寸工具，避免真实渲染与文件写入。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PagesEnum } from '@/types/Common'

// 提前构造 pdf-lib 的 mock 对象，供 vi.mock 工厂在模块加载前使用
const pdfMocks = vi.hoisted(() => {
  const drawImage = vi.fn()
  const page = { drawImage }
  const image = { width: 100, height: 50 }
  const doc = {
    embedJpg: vi.fn(async () => image),
    addPage: vi.fn(() => page),
    save: vi.fn(async () => new Uint8Array([1, 2, 3]))
  }

  return { create: vi.fn(async () => doc), doc, drawImage, image }
})

// mock dom-to-image 的 toJpeg，返回固定的 JPEG dataURL
const domtoimageMocks = vi.hoisted(() => ({ toJpeg: vi.fn() }))

// 用 mock 替换真实依赖：PDF 创建、DOM 截图与页面像素尺寸换算
vi.mock('pdf-lib', () => ({ PDFDocument: { create: pdfMocks.create } }))
vi.mock('dom-to-image', () => ({ default: { toJpeg: domtoimageMocks.toJpeg } }))
vi.mock('@/utils/pageSizeInPixelUtil', () => ({
  pageSizeInPixels: vi.fn(() => ({ width: 595, height: 842 }))
}))

import { exportPDF } from '@/utils/pdfUtil'

// exportPDF 导出功能测试组
describe('exportPDF', () => {
  // 每个用例前重置 mock，并准备下载所需的浏览器 API
  beforeEach(() => {
    vi.clearAllMocks()
    domtoimageMocks.toJpeg.mockResolvedValue('data:image/jpeg;base64,AAA')
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })))

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:mock') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })

    // 桩掉 createElement，为 <a> 元素提供可控的 click 方法
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options)

      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { value: vi.fn() })
      }

      return element
    })
  })

  // 用例结束后恢复 mock 与全局桩
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('将 DOM 元素导出为 PDF', async () => {
    const element = document.createElement('div')
    const result = await exportPDF([element], PagesEnum.A4, 4, 'test.pdf')

    expect(result.success).toBe(true)
    expect(pdfMocks.doc.embedJpg).toHaveBeenCalledTimes(1)
    expect(pdfMocks.doc.addPage).toHaveBeenCalledWith([595, 842])
    expect(pdfMocks.drawImage).toHaveBeenCalledWith(pdfMocks.image, {
      x: 0,
      y: 544.5,
      width: 595,
      height: 297.5
    })
  })

  it('渲染失败时返回 success:false 与错误对象', async () => {
    domtoimageMocks.toJpeg.mockRejectedValueOnce(new Error('render failed'))
    const element = document.createElement('div')

    const result = await exportPDF([element], PagesEnum.A4)

    expect(result.success).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })
})
