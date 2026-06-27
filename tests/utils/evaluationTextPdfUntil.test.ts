import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PagesEnum } from '../../src/types/Common'
import { NAME_PROP } from '../../src/types/Constants'
import type { ConfigurationType } from '../../src/types/Configuration'

const pdfMocks = vi.hoisted(() => {
  const drawText = vi.fn()
  const drawLine = vi.fn()
  const page = { drawText, drawLine }
  const font = {
    widthOfTextAtSize: vi.fn((text: string, size: number) => text.length * size)
  }
  const doc = {
    addPage: vi.fn(() => page),
    embedFont: vi.fn(async () => font),
    registerFontkit: vi.fn(),
    save: vi.fn(async () => new Uint8Array([1, 2, 3]))
  }

  return {
    doc,
    drawText,
    font,
    page,
    create: vi.fn(async () => doc),
    rgb: vi.fn((red: number, green: number, blue: number) => ({ red, green, blue }))
  }
})

const fontkitMocks = vi.hoisted(() => ({
  create: vi.fn(() => ({
    hasGlyphForCodePoint: vi.fn(() => true)
  }))
}))

const handwriteFontMocks = vi.hoisted(() => ({
  getEvaluationHandwriteFontBytes: vi.fn(async () => new Uint8Array(2048)),
  getEvaluationHandwriteMeasureFontFamily: vi.fn(() => 'sans-serif')
}))

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: pdfMocks.create
  },
  rgb: pdfMocks.rgb
}))

vi.mock('@pdf-lib/fontkit', () => ({
  default: fontkitMocks
}))

vi.mock('../../src/utils/evaluationHandwriteFontUntil', () => handwriteFontMocks)

const createCanvasContextMock = () => {
  let currentFontSize = 16

  return {
    get font() {
      return `${currentFontSize}px sans-serif`
    },
    set font(value: string) {
      currentFontSize = Number.parseInt(value, 10) || currentFontSize
    },
    measureText(text: string) {
      return { width: Array.from(text).length * currentFontSize }
    }
  }
}

const createConfiguration = (): ConfigurationType => ({
  fontSize: 18,
  salutationFontSize: 18,
  textFontSize: 18,
  sealFontSize: 18,
  classTeacherFontSize: 18,
  inscribeFontSize: 18,
  inscribe: '',
  showEvaluationPageNumber: true,
  pageType: PagesEnum.A4,
  pageTypeList: [PagesEnum.A4],
  evaluationCardWidth: 36,
  evaluationCardHeight: 31,
  marginX: 15,
  marginY: 7.5,
  evaluationTableAlign: 'left',
  previewMode: '100',
  inputScoreTab: null,
  recentScoreEntries: {},
  scoreImageCompressRatio: 0.6,
  evaluationHandwriteFont: null
})

describe('exportEvaluationTextPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options)

      if (tagName.toLowerCase() === 'canvas') {
        Object.defineProperty(element, 'getContext', {
          value: () => createCanvasContextMock()
        })
      }

      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', {
          value: vi.fn()
        })
      }

      return element
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(2048)
      }))
    )

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:mock-pdf')
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses the same adaptive comment font size as preview when exporting PDF', async () => {
    const { exportEvaluationTextPDF } = await import('../../src/utils/evaluationTextPdfUntil')

    const result = await exportEvaluationTextPDF({
      students: [{ [NAME_PROP]: '张三', comment: '一二三四五六七八九十' }],
      configuration: createConfiguration(),
      fileName: 'test.pdf'
    })

    const bodyDrawCalls = pdfMocks.drawText.mock.calls.filter(([text, options]) => {
      return text === '一' && options?.size === 12
    })

    expect(result.success).toBe(true)
    expect(result.truncatedStudents).toEqual([])
    expect(bodyDrawCalls.length).toBeGreaterThan(0)
    expect(
      pdfMocks.drawText.mock.calls.some(([text, options]) => text === '一' && options?.size === 13.5)
    ).toBe(false)
  })
})
