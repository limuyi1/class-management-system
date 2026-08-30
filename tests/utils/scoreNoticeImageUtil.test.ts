/**
 * 测试 scoreNoticeImageUtil 模块。
 * 覆盖：文件名清洗、Blob 下载与对象 URL 延迟释放、PNG 复制到剪贴板，
 * 以及借助 mock dom-to-image 与手写字体把 DOM 元素渲染为 PNG Blob。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 提前构造 dom-to-image 与手写字体工具的 mock，供 vi.mock 工厂使用
const domtoimageMocks = vi.hoisted(() => ({ toSvg: vi.fn() }))
const handwriteFontMocks = vi.hoisted(() => ({ getEvaluationHandwriteFontDataUrl: vi.fn() }))

// 用 mock 替换 DOM 截图与手写字体加载，避免真实渲染
vi.mock('dom-to-image', () => ({ default: { toSvg: domtoimageMocks.toSvg } }))
vi.mock('@/utils/evaluation/evaluationHandwriteFontUtil', () => ({
  getEvaluationHandwriteFontDataUrl: handwriteFontMocks.getEvaluationHandwriteFontDataUrl
}))

import {
  copyPngBlob,
  downloadBlob,
  renderScoreNoticeBlob,
  sanitizeFileName
} from '@/utils/score-notice/scoreNoticeImageUtil'

// 文件名清洗测试组：替换非法字符并在空白时回退默认名称
describe('sanitizeFileName', () => {
  it('替换文件名中的非法字符', () => {
    expect(sanitizeFileName('一班/座位表:*?')).toBe('一班_座位表___')
  })

  it('空白名称回退为默认名称', () => {
    expect(sanitizeFileName('   ')).toBe('成绩通知')
    expect(sanitizeFileName('')).toBe('成绩通知')
  })
})

// Blob 下载测试组：触发下载并延迟释放对象 URL
describe('downloadBlob', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  // 使用假定时器，并桩掉 URL 与 createElement 相关 API 模拟浏览器下载
  beforeEach(() => {
    vi.useFakeTimers()
    createObjectURL = vi.fn(() => 'blob:mock')
    revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })

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
    vi.useRealTimers()
  })

  it('触发下载并延迟释放对象 URL', () => {
    const blob = new Blob(['x'], { type: 'text/plain' })

    downloadBlob(blob, 'a.txt')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})

// 复制 PNG 到剪贴板测试组：根据剪贴板 API 可用性返回结果
describe('copyPngBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('剪贴板可用时返回 true', async () => {
    const write = vi.fn(async () => {})
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })
    vi.stubGlobal('navigator', { clipboard: { write } })

    const blob = new Blob(['x'], { type: 'image/png' })

    await expect(copyPngBlob(blob)).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('剪贴板不可用时返回 false', async () => {
    vi.stubGlobal('navigator', {})

    const blob = new Blob(['x'], { type: 'image/png' })

    await expect(copyPngBlob(blob)).resolves.toBe(false)
  })
})

// DOM 元素渲染为 PNG Blob 测试组
describe('renderScoreNoticeBlob', () => {
  // 桩掉 canvas 与 Image，模拟 SVG → canvas → PNG 的渲染链路
  beforeEach(() => {
    domtoimageMocks.toSvg.mockResolvedValue('data:image/svg+xml,<svg></svg>')
    handwriteFontMocks.getEvaluationHandwriteFontDataUrl.mockResolvedValue(
      'data:font/ttf;base64,AAA'
    )

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options)

      if (tagName.toLowerCase() === 'canvas') {
        Object.defineProperty(element, 'getContext', {
          value: () => ({ drawImage: vi.fn() })
        })
        Object.defineProperty(element, 'toBlob', {
          value: (callback: (blob: Blob | null) => void) =>
            callback(new Blob(['x'], { type: 'image/png' }))
        })
      }

      return element
    })

    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('将 DOM 元素渲染为 PNG Blob', async () => {
    const element = { offsetWidth: 100, offsetHeight: 50 } as unknown as HTMLElement

    const blob = await renderScoreNoticeBlob(element, 2)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    expect(domtoimageMocks.toSvg).toHaveBeenCalledWith(element, {
      bgcolor: '#fdfbf5',
      width: 100,
      height: 50
    })
  })
})
