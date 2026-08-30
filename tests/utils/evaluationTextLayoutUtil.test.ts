/**
 * evaluationTextLayoutUtil 测试
 * 覆盖评语自适应排版（layoutAdaptiveCommentText），
 * 通过 mock canvas 测量文本宽度，验证字号缩放、截断与提示逻辑。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// mock canvas 上下文：以「字符数 × 字号」估算文本宽度
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

// 评语自适应排版：根据可用宽高自动调整字号与截断提示
describe('evaluationTextLayoutUtil', () => {
  // 每个用例前 mock document.createElement，为 canvas 元素注入假测量上下文
  beforeEach(() => {
    vi.resetModules()
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options)

      if (tagName.toLowerCase() === 'canvas') {
        Object.defineProperty(element, 'getContext', {
          value: () => createCanvasContextMock()
        })
      }

      return element
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps default font size and disables tooltip when the comment fits', async () => {
    const { layoutAdaptiveCommentText } = await import('../../src/utils/evaluation/evaluationTextLayoutUtil')

    const layout = layoutAdaptiveCommentText('表现好', 18, 12, 160, 60)

    expect(layout.fontSizePx).toBe(18)
    expect(layout.truncated).toBe(false)
    expect(layout.showTooltip).toBe(false)
    expect(layout.lines.map((line) => line.text).join('')).toBe('表现好')
  })

  it('shrinks font and disables tooltip when a small overflow can be fully displayed', async () => {
    const { layoutAdaptiveCommentText } = await import('../../src/utils/evaluation/evaluationTextLayoutUtil')

    const layout = layoutAdaptiveCommentText('一二三四五六七八九十', 18, 12, 120, 48)

    expect(layout.fontSizePx).toBe(16)
    expect(layout.truncated).toBe(false)
    expect(layout.showTooltip).toBe(false)
    expect(layout.lines.map((line) => line.text).join('')).toBe('一二三四五六七八九十')
  })

  it('falls back to default font size and enables tooltip when min font still overflows', async () => {
    const { layoutAdaptiveCommentText } = await import('../../src/utils/evaluation/evaluationTextLayoutUtil')

    const layout = layoutAdaptiveCommentText('一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十', 18, 12, 120, 48)

    expect(layout.fontSizePx).toBe(18)
    expect(layout.truncated).toBe(true)
    expect(layout.showTooltip).toBe(true)
    expect(layout.lines.at(-1)?.text.endsWith('...')).toBe(true)
  })
})
