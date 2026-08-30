import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatHandwriteFontName,
  useEvaluationHandwriteFont
} from '@/views/evaluation/composables/useEvaluationHandwriteFont'
import { PagesEnum } from '@/types/Common'
import type { ConfigurationType } from '@/types/Configuration'

/**
 * useEvaluationHandwriteFont 组合式函数测试
 * 测试目标：评语手写字体选择与应用逻辑
 * 覆盖功能：长字体名缩写、触发隐藏文件输入框、保存字体并清空输入、初始化时恢复已保存字体
 */

// 字体工具函数替身，隔离对字体文件的真实读写
const fontUtilMocks = vi.hoisted(() => ({
  clearEvaluationHandwriteFont: vi.fn(),
  getDefaultFontSlowNoticeMs: vi.fn(() => 10),
  hasSavedHandwriteFont: vi.fn(() => false),
  registerEvaluationHandwriteFont: vi.fn(),
  saveEvaluationHandwriteFont: vi.fn(),
  waitForDefaultHandwriteFont: vi.fn()
}))

// ElMessage 各类提示替身
const messageMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn()
}))

vi.mock('@/utils/evaluation/evaluationHandwriteFontUtil', () => fontUtilMocks)

vi.mock('element-plus', () => ({
  ElMessage: messageMocks
}))

// 构造完整的应用配置对象，字号统一为 18
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

// 覆盖字体选择、保存、初始化的主要交互路径
describe('useEvaluationHandwriteFont', () => {
  // 每个用例前重置 mock 调用记录与字体工具默认返回值
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
