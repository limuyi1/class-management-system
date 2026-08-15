import { describe, expect, it } from 'vitest'
import { renderKatex, renderKatexBlock, renderMarkdown } from '../../src/utils/katexUtil'

describe('renderKatex', () => {
  it('should return empty string for empty input', () => {
    const result = renderKatex('')
    expect(result).toBe('')
  })

  it('should return input unchanged when no formulas present', () => {
    const input = '<p>Hello World</p>'
    const result = renderKatex(input)
    expect(result).toBe(input)
  })

  it('should render inline katex formula', () => {
    const input = '<p>$x^2$</p>'
    const result = renderKatex(input)
    expect(result).toContain('katex')
    expect(result).toContain('x^2')
  })

  it('should handle formula with spaces', () => {
    const input = '<p>$ x + y $</p>'
    const result = renderKatex(input)
    expect(result).toContain('katex')
    expect(result).toContain('x + y')
  })

  it('should handle multiple formulas', () => {
    const input = '<p>$a$ and $b$</p>'
    const result = renderKatex(input)
    expect(result).toContain('katex')
  })

  it('should not render block formula as inline', () => {
    const input = '<p>$$x^2$$</p>'
    const result = renderKatex(input)
    expect(result).toContain('katex')
  })
})

describe('renderKatexBlock', () => {
  it('should return empty string for empty input', () => {
    const result = renderKatexBlock('')
    expect(result).toBe('')
  })

  it('should return input unchanged when no formulas present', () => {
    const input = '<p>Hello World</p>'
    const result = renderKatexBlock(input)
    expect(result).toBe(input)
  })

  it('should render block katex formula', () => {
    const input = '<p>$$x^2$$</p>'
    const result = renderKatexBlock(input)
    expect(result).toContain('katex')
    expect(result).toContain('x^2')
    expect(result).toContain('display')
  })

  it('should render block formula with spaces', () => {
    const input = '<p>$$ x + y $$</p>'
    const result = renderKatexBlock(input)
    expect(result).toContain('katex')
  })

  it('should render both block and inline formulas', () => {
    const input = '<p>$$x^2$$ and $y$</p>'
    const result = renderKatexBlock(input)
    expect(result).toContain('katex')
  })

  it('should handle formula with newlines', () => {
    const input = '<p>$$\nx + y\n$$</p>'
    const result = renderKatexBlock(input)
    expect(result).toContain('katex')
  })
})

describe('renderMarkdown', () => {
  it('should return empty string for empty input', () => {
    const result = renderMarkdown('')
    expect(result).toBe('')
  })

  it('should render simple markdown', () => {
    const input = 'Hello World'
    const result = renderMarkdown(input)
    expect(result).toBeTruthy()
  })

  it('should render inline formula in markdown', () => {
    const input = '$x^2$'
    const result = renderMarkdown(input)
    expect(result).toContain('katex')
  })

  it('should render block formula in markdown', () => {
    const input = '$$x^2$$'
    const result = renderMarkdown(input)
    expect(result).toContain('katex')
  })

  it('should render mixed content', () => {
    const input = '# Title\n\nParagraph with $x$ formula'
    const result = renderMarkdown(input)
    expect(result).toContain('<h1>')
    expect(result).toContain('katex')
  })
})
