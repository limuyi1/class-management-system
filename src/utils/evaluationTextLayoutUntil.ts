import type { ConfigurationType } from '@/types/Configuration'
import { getEvaluationHandwriteMeasureFontFamily } from '@/utils/evaluationHandwriteFontUntil'

const PX_TO_MM = 25.4 / 96
const BODY_LINE_HEIGHT_RATIO = 1.45
const FOOTER_LINE_HEIGHT_RATIO = 1.3
const INNER_PADDING_X_PX = 8
const INNER_PADDING_Y_PX = 8
const HEADER_GAP_PX = 2
const BODY_GAP_PX = 1
const FOOTER_GAP_PX = 4

export interface EvaluationCommentLineType {
  text: string
  indent: boolean
}

export interface EvaluationCommentLayoutResultType {
  lines: EvaluationCommentLineType[]
  truncated: boolean
  lineHeightPx: number
  indentWidthPx: number
}

const createMeasureContext = () => {
  const canvas = document.createElement('canvas')
  return canvas.getContext('2d')
}

const getMeasureContext = (() => {
  let ctx: CanvasRenderingContext2D | null | undefined

  return () => {
    if (ctx !== undefined) return ctx
    ctx = createMeasureContext()
    return ctx
  }
})()

// 共享排版引擎统一以当前手写字体栈度量，确保上传字体后预览与 PDF 仍共用断行结果。
const setMeasureFont = (fontSizePx: number) => {
  const ctx = getMeasureContext()
  if (!ctx) return null

  ctx.font = `${fontSizePx}px ${getEvaluationHandwriteMeasureFontFamily()}`
  return ctx
}

export const measureBrowserCharAdvanceWidth = (char: string, fontSizePx: number) => {
  const ctx = setMeasureFont(fontSizePx)
  if (!ctx) return fontSizePx

  return ctx.measureText(char).width
}

export const measureBrowserTextAdvanceWidth = (text: string, fontSizePx: number) => {
  return Array.from(text).reduce(
    (total, char) => total + measureBrowserCharAdvanceWidth(char, fontSizePx),
    0
  )
}

// 按字符累加宽度而不是依赖浏览器自动换行，这样预览和 PDF 才能严格复用同一套断行规则。
const splitParagraphLines = (text: string, maxWidthPx: number, fontSizePx: number): string[] => {
  const chars = Array.from(text)
  const lines: string[] = []
  let current = ''
  let currentWidth = 0

  chars.forEach((char) => {
    const charWidth = measureBrowserCharAdvanceWidth(char, fontSizePx)

    if (current && currentWidth + charWidth > maxWidthPx) {
      lines.push(current)
      current = char
      currentWidth = charWidth
      return
    }

    current += char
    currentWidth += charWidth
  })

  if (current || !lines.length) {
    lines.push(current)
  }

  return lines
}

const normalizeCommentParagraphs = (comment: string): string[] => {
  const paragraphs = comment
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  return paragraphs.length ? paragraphs : ['']
}

const ellipsizeLine = (text: string, maxWidthPx: number, fontSizePx: number): string => {
  if (!text) return '...'

  let current = text
  while (current && measureBrowserTextAdvanceWidth(`${current}...`, fontSizePx) > maxWidthPx) {
    current = Array.from(current).slice(0, -1).join('')
  }

  return current ? `${current}...` : '...'
}

export const layoutCommentText = (
  comment: string,
  fontSizePx: number,
  maxWidthPx: number,
  maxHeightPx: number
): EvaluationCommentLayoutResultType => {
  const paragraphs = normalizeCommentParagraphs(comment)
  const indentWidthPx = measureBrowserTextAdvanceWidth('好好', fontSizePx)
  const rawLines: EvaluationCommentLineType[] = []

  paragraphs.forEach((paragraph) => {
    const firstLineWidth = Math.max(maxWidthPx - indentWidthPx, 1)
    const paragraphLines = splitParagraphLines(paragraph, maxWidthPx, fontSizePx)

    if (!paragraphLines.length) {
      rawLines.push({ text: '', indent: true })
      return
    }

    const firstLine = splitParagraphLines(paragraph, firstLineWidth, fontSizePx)
    const firstText = firstLine[0] || paragraphLines[0] || ''
    rawLines.push({ text: firstText, indent: true })

    const remainingText = Array.from(paragraph).slice(Array.from(firstText).length).join('')
    if (!remainingText) return

    splitParagraphLines(remainingText, maxWidthPx, fontSizePx).forEach((line) => {
      rawLines.push({ text: line, indent: false })
    })
  })

  const lineHeightPx = fontSizePx * BODY_LINE_HEIGHT_RATIO
  const maxLines = Math.max(1, Math.floor(maxHeightPx / lineHeightPx))

  if (rawLines.length <= maxLines) {
    return {
      lines: rawLines,
      truncated: false,
      lineHeightPx,
      indentWidthPx
    }
  }

  const lines = rawLines.slice(0, Math.max(maxLines, 1))
  const lastIndex = lines.length - 1
  const lastLine = lines[lastIndex]
  const lastLineWidth = lastLine.indent ? Math.max(maxWidthPx - indentWidthPx, 1) : maxWidthPx
  // 截断规则也下沉到共享层，避免出现“预览能放下、PDF 却截断”或反过来的分裂行为。
  lines[lastIndex] = {
    ...lastLine,
    text: ellipsizeLine(lastLine.text.trimEnd(), lastLineWidth, fontSizePx)
  }

  return {
    lines,
    truncated: true,
    lineHeightPx,
    indentWidthPx
  }
}

export const getEvaluationTextLayoutConstantsPx = () => ({
  innerPaddingX: INNER_PADDING_X_PX,
  innerPaddingY: INNER_PADDING_Y_PX,
  headerGap: HEADER_GAP_PX,
  bodyGap: BODY_GAP_PX,
  footerGap: FOOTER_GAP_PX,
  bodyLineHeightRatio: BODY_LINE_HEIGHT_RATIO,
  footerLineHeightRatio: FOOTER_LINE_HEIGHT_RATIO,
  pxToMm: PX_TO_MM
})

export const getFooterBlockHeightPx = (configuration: ConfigurationType) => {
  return Math.max(
    configuration.sealFontSize * FOOTER_LINE_HEIGHT_RATIO,
    configuration.classTeacherFontSize * FOOTER_LINE_HEIGHT_RATIO,
    configuration.inscribeFontSize * FOOTER_LINE_HEIGHT_RATIO
  )
}
