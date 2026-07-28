/** KaTeX 数学公式渲染工具 */
import { marked } from 'marked'
import katex from 'katex'

/**
 * Markdown 渲染配置
 * 启用自动换行
 */
marked.setOptions({
  breaks: true
})

/**
 * 渲染 Markdown 内容为 HTML（支持 Katex 数学公式）
 * 流程：Markdown -> HTML -> Katex 公式渲染
 * @param content - Markdown 格式的原始内容
 * @returns 渲染后的 HTML 字符串
 */
export const renderMarkdown = (content: string): string => {
  if (!content) return content

  const html = marked.parse(content, { async: false }) as string
  return renderKatexBlock(html)
}

/**
 * 渲染行内 Katex 数学公式
 * 匹配规则：$formula$ 或 $ formula $
 * @param html - 包含 Katex 占位符的 HTML 字符串
 * @returns 渲染后的 HTML 字符串
 */
export const renderKatex = (html: string): string => {
  if (!html) return html

  /**
   * 行内公式匹配模式：$...$
   * 不跨越换行符
   */
  const inlinePattern = /\$([^$\n]+)\$/g

  return html.replace(inlinePattern, (_match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        throwOnError: false,
        displayMode: false
      })
    } catch {
      return _match
    }
  })
}

/**
 * 渲染块级 Katex 数学公式
 * 匹配规则：$$formula$$ 或 $$ formula $$
 * 先处理块级公式（$$），再处理行内公式（$）
 * @param html - 包含 Katex 占位符的 HTML 字符串
 * @returns 渲染后的 HTML 字符串
 */
export const renderKatexBlock = (html: string): string => {
  if (!html) return html

  /**
   * 块级公式匹配模式：$$...$$
   * 可以跨越换行符
   */
  const blockPattern = /\$\$([^$]+)\$\$/g

  const result = html.replace(blockPattern, (_match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        throwOnError: false,
        displayMode: true
      })
    } catch {
      return _match
    }
  })

  return renderKatex(result)
}
