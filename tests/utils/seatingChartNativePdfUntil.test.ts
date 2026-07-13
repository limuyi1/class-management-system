import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PagesEnum } from '@/types/Common'
import { SeatingViewDirectionEnum, type SeatingChartType } from '@/types/SeatingChart'
import { createSeats, createSpecialSeats } from '@/utils/seatingChartUntil'

const pdfMocks = vi.hoisted(() => {
  const drawText = vi.fn()
  const drawRectangle = vi.fn()
  const drawLine = vi.fn()
  const page = {
    drawText,
    drawRectangle,
    drawLine,
    getHeight: vi.fn(() => 595.28)
  }
  const font = {
    widthOfTextAtSize: vi.fn((text: string, size: number) => Array.from(text).length * size)
  }
  const doc = {
    registerFontkit: vi.fn(),
    embedFont: vi.fn(async () => font),
    addPage: vi.fn(() => page),
    save: vi.fn(async () => new Uint8Array([1, 2, 3]))
  }

  return {
    create: vi.fn(async () => doc),
    doc,
    drawLine,
    drawRectangle,
    drawText,
    font,
    page,
    rgb: vi.fn((red: number, green: number, blue: number) => ({ red, green, blue }))
  }
})

vi.mock('pdf-lib', () => ({
  PDFDocument: { create: pdfMocks.create },
  rgb: pdfMocks.rgb
}))

vi.mock('@pdf-lib/fontkit', () => ({ default: {} }))
vi.mock('dom-to-image', () => ({ default: { toPng: vi.fn() } }))

function createChart(): SeatingChartType {
  const seats = createSeats(2, 2)
  seats[0].studentId = 'student-1'
  return {
    id: 'chart',
    name: '一班座位表',
    rows: 2,
    columns: 2,
    aisleAfterColumns: [0],
    viewDirection: SeatingViewDirectionEnum.FacingPlatform,
    seats,
    specialSeats: createSpecialSeats(),
    createdAt: '',
    updatedAt: ''
  }
}

describe('native seating chart PDF export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024 * 1024 + 1)
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws searchable text and vector shapes without embedding an image', async () => {
    const { createSeatingChartPdf } = await import('@/utils/seatingChartExportUntil')
    const blob = await createSeatingChartPdf({
      chart: createChart(),
      studentNames: { 'student-1': '张三' },
      showEmptyLabels: true,
      pageType: PagesEnum.A4
    })

    const drawnTexts = pdfMocks.drawText.mock.calls.map(([text]) => text)
    expect(blob.type).toBe('application/pdf')
    expect(pdfMocks.doc.registerFontkit).toHaveBeenCalledTimes(1)
    expect(pdfMocks.doc.embedFont).toHaveBeenCalledWith(expect.any(Uint8Array), { subset: false })
    expect(drawnTexts).toEqual(expect.arrayContaining(['一班座位表', '讲 台', '张三', '空座位']))
    expect(pdfMocks.drawRectangle.mock.calls.length).toBeGreaterThan(6)
    expect(pdfMocks.drawLine).toHaveBeenCalledTimes(1)
    expect(pdfMocks.doc).not.toHaveProperty('embedPng')
  })
})
