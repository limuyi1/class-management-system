import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PagesEnum } from '@/types/Common'

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

const domtoimageMocks = vi.hoisted(() => ({ toJpeg: vi.fn() }))

vi.mock('pdf-lib', () => ({ PDFDocument: { create: pdfMocks.create } }))
vi.mock('dom-to-image', () => ({ default: { toJpeg: domtoimageMocks.toJpeg } }))
vi.mock('@/utils/pageSizeInPixelUtil', () => ({
  pageSizeInPixels: vi.fn(() => ({ width: 595, height: 842 }))
}))

import { exportPDF } from '@/utils/pdfUtil'

describe('exportPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    domtoimageMocks.toJpeg.mockResolvedValue('data:image/jpeg;base64,AAA')
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })))

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:mock') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options)

      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { value: vi.fn() })
      }

      return element
    })
  })

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
