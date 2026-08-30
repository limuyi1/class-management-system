/**
 * evaluationHandwriteFontUtil 测试
 * 覆盖手写字体渲染字符判定（isEvaluationRenderableTextChar），
 * 验证空白与不可见格式字符被排除、可见字符被保留用于字形覆盖检查。
 */

import { describe, expect, it } from 'vitest'
import { isEvaluationRenderableTextChar } from '../../src/utils/evaluation/evaluationHandwriteFontUtil'

// 可渲染字符判定：过滤空白与不可见格式字符，保留可见字符
describe('isEvaluationRenderableTextChar', () => {
  it('should ignore whitespace and invisible format characters', () => {
    expect(isEvaluationRenderableTextChar('\n')).toBe(false)
    expect(isEvaluationRenderableTextChar(' ')).toBe(false)
    expect(isEvaluationRenderableTextChar('\u3000')).toBe(false)
    expect(isEvaluationRenderableTextChar('\u200b')).toBe(false)
    expect(isEvaluationRenderableTextChar('\ufe0f')).toBe(false)
  })

  it('should keep visible characters for glyph coverage checks', () => {
    expect(isEvaluationRenderableTextChar('贇')).toBe(true)
    expect(isEvaluationRenderableTextChar('班')).toBe(true)
    expect(isEvaluationRenderableTextChar('：')).toBe(true)
  })
})
