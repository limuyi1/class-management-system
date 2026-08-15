import { describe, expect, it } from 'vitest'
import { isEvaluationRenderableTextChar } from '../../src/utils/evaluationHandwriteFontUtil'

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
