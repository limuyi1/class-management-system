import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatHandwriteFontName,
  useEvaluationHandwriteFont
} from '@/views/evaluation/composables/useEvaluationHandwriteFont'
import { PagesEnum } from '@/types/Common'
import type { ConfigurationType } from '@/types/Configuration'

const fontUtilMocks = vi.hoisted(() => ({
  clearEvaluationHandwriteFont: vi.fn(),
  getDefaultFontSlowNoticeMs: vi.fn(() => 10),
  hasSavedHandwriteFont: vi.fn(() => false),
  registerEvaluationHandwriteFont: vi.fn(),
  saveEvaluationHandwriteFont: vi.fn(),
  waitForDefaultHandwriteFont: vi.fn()
}))

const messageMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn()
}))

vi.mock('@/utils/evaluationHandwriteFontUntil', () => fontUtilMocks)

vi.mock('element-plus', () => ({
  ElMessage: messageMocks
}))

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
  evaluationCardWidth: 90,
  evaluationCardHeight: 69,
  marginX: 15,
  marginY: 7.5,
  evaluationTableAlign: 'left',
  previewMode: '100',
  inputScoreTab: null,
  recentScoreEntries: {},
  scoreImageCompressRatio: 0.6,
  evaluationHandwriteFont: null
})

describe('useEvaluationHandwriteFont', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fontUtilMocks.hasSavedHandwriteFont.mockReturnValue(false)
    fontUtilMocks.waitForDefaultHandwriteFont.mockResolvedValue(undefined)
    fontUtilMocks.saveEvaluationHandwriteFont.mockResolvedValue(undefined)
  })

  it('should shorten long font names while keeping the extension', () => {
    expect(formatHandwriteFontName('ExampleHandwritingFont.ttf')).toBe('Examp...ont.ttf')
    expect(formatHandwriteFontName('short.otf')).toBe('short.otf')
  })

  it('should trigger the hidden font input when choosing a font', () => {
    const input = { click: vi.fn() } as unknown as HTMLInputElement
    const hook = useEvaluationHandwriteFont({
      configuration: createConfiguration(),
      fontFileInputRef: ref(input)
    })

    hook.handleChooseHandwriteFont()

    expect(input.click).toHaveBeenCalled()
  })

  it('should save selected font and reset input value', async () => {
    const hook = useEvaluationHandwriteFont({
      configuration: createConfiguration(),
      fontFileInputRef: ref(null)
    })
    const file = new File(['font'], 'font.otf', { type: 'font/otf' })
    const input = {
      files: [file],
      value: 'font.otf'
    } as unknown as HTMLInputElement

    await hook.handleHandwriteFontChange({ target: input } as unknown as Event)

    expect(fontUtilMocks.saveEvaluationHandwriteFont).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
    expect(hook.handwriteFontApplying.value).toBe(false)
    expect(messageMocks.success).toHaveBeenCalledWith('手写字体已应用')
  })

  it('should restore saved font and refresh configuration reference on initialize', async () => {
    const configuration = createConfiguration()
    configuration.evaluationHandwriteFont = {
      name: 'font.otf',
      data: 'data',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    fontUtilMocks.hasSavedHandwriteFont.mockReturnValue(true)

    const hook = useEvaluationHandwriteFont({
      configuration,
      fontFileInputRef: ref(null)
    })
    const previousFont = configuration.evaluationHandwriteFont

    await hook.initializeHandwriteFont()

    expect(fontUtilMocks.registerEvaluationHandwriteFont).toHaveBeenCalled()
    expect(configuration.evaluationHandwriteFont).toEqual(previousFont)
    expect(configuration.evaluationHandwriteFont).not.toBe(previousFont)
  })
})
