import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PagesEnum } from '@/types/Common'

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

vi.mock('pdf-lib', () => ({
  PDFDocument: { create: pdfMocks.create }
}))
vi.mock('dom-to-image', () => ({ default: { toPng: vi.fn() } }))

describe('image-based seating chart PDF export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('embeds the rendered PNG across the selected paper page', async () => {
    const { createSeatingChartPdf } = await import('@/utils/seatingChartExportUntil')
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
