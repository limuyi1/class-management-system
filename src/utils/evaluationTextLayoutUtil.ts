import type { ConfigurationType } from '@/types/Configuration'
import { getEvaluationHandwriteMeasureFontFamily } from '@/utils/evaluationHandwriteFontUtil'

/** 像素转毫米系数（按 96 DPI） */
const PX_TO_MM = 25.4 / 96
/** 正文行高相对字号的比例 */
const BODY_LINE_HEIGHT_RATIO = 1.45
/** 页脚行高相对字号的比例 */
const FOOTER_LINE_HEIGHT_RATIO = 1.3
/** 评语格内左右内边距（像素） */
const INNER_PADDING_X_PX = 8
/** 评语格内上下内边距（像素） */
const INNER_PADDING_Y_PX = 8
/** 称呼与正文之间的间距（像素） */
const HEADER_GAP_PX = 2
/** 正文与页脚之间的间距（像素） */
const BODY_GAP_PX = 1
/** 页脚各要素之间的间距（像素） */
const FOOTER_GAP_PX = 4
/** 自适应排版时的最小字号，再小也无法放下时触发截断提示 */
export const MIN_ADAPTIVE_COMMENT_FONT_SIZE_PX = 12

/** 评语断行后的一行文本，indent 标识是否首行缩进 */
export interface EvaluationCommentLineType {
  text: string
  indent: boolean
}

/** 评语排版结果：断行、是否截断、行高与缩进宽度 */
export interface EvaluationCommentLayoutResultType {
  lines: EvaluationCommentLineType[]
  truncated: boolean
  lineHeightPx: number
  indentWidthPx: number
}

/** 自适应排版结果：在基础排版之上追加实际字号与是否需悬浮提示 */
export interface AdaptiveEvaluationCommentLayoutResultType
  extends EvaluationCommentLayoutResultType {
  fontSizePx: number
  showTooltip: boolean
}

/** 创建用于测量文本宽度的 canvas 2D 上下文 */
const createMeasureContext = () => {
  const canvas = document.createElement('canvas')
  return canvas.getContext('2d')
}

/** 惰性创建并缓存测量上下文，避免反复创建 canvas */
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

/**
 * 测量单个字符在指定字号下的水平推进宽度。
 * @param char - 待测量字符
 * @param fontSizePx - 字号（像素）
 * @returns 字符宽度（像素），测量失败时回退为字号大小
 */
export const measureBrowserCharAdvanceWidth = (char: string, fontSizePx: number) => {
  const ctx = setMeasureFont(fontSizePx)
  if (!ctx) return fontSizePx

  return ctx.measureText(char).width
}

/**
 * 逐字符累加得到整段文本的水平推进宽度。
 * @param text - 待测量文本
 * @param fontSizePx - 字号（像素）
 * @returns 文本总宽度（像素）
 */
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

/** 将评语按换行拆分为非空段落，无内容时返回单个空段落 */
const normalizeCommentParagraphs = (comment: string): string[] => {
  const paragraphs = comment
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  return paragraphs.length ? paragraphs : ['']
}

/** 按最大宽度截断文本并追加省略号 */
const ellipsizeLine = (text: string, maxWidthPx: number, fontSizePx: number): string => {
  if (!text) return '...'

  let current = text
  while (current && measureBrowserTextAdvanceWidth(`${current}...`, fontSizePx) > maxWidthPx) {
    current = Array.from(current).slice(0, -1).join('')
  }

  return current ? `${current}...` : '...'
}

/**
 * 对评语执行断行与截断排版，首行按两字符缩进。
 * @param comment - 评语内容
 * @param fontSizePx - 字号（像素）
 * @param maxWidthPx - 可用宽度（像素）
 * @param maxHeightPx - 可用高度（像素）
 * @returns 排版结果（断行、是否截断、行高、缩进宽度）
 */
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

/**
 * 自适应排版：优先用默认字号，放不下时逐级缩小到最小字号；
 * 仍放不下则保留默认排版并标记需悬浮提示。
 * @param comment - 评语内容
 * @param defaultFontSizePx - 默认字号（像素）
 * @param minFontSizePx - 允许的最小字号（像素）
 * @param maxWidthPx - 可用宽度（像素）
 * @param maxHeightPx - 可用高度（像素）
 * @returns 自适应排版结果
 */
export const layoutAdaptiveCommentText = (
  comment: string,
  defaultFontSizePx: number,
  minFontSizePx: number,
  maxWidthPx: number,
  maxHeightPx: number
): AdaptiveEvaluationCommentLayoutResultType => {
  const defaultLayout = layoutCommentText(comment, defaultFontSizePx, maxWidthPx, maxHeightPx)

  if (!defaultLayout.truncated) {
    return {
      ...defaultLayout,
      fontSizePx: defaultFontSizePx,
      showTooltip: false
    }
  }

  const minimumFontSize = Math.max(1, Math.min(defaultFontSizePx, minFontSizePx))

  for (let fontSize = defaultFontSizePx - 1; fontSize >= minimumFontSize; fontSize -= 1) {
    const nextLayout = layoutCommentText(comment, fontSize, maxWidthPx, maxHeightPx)

    if (!nextLayout.truncated) {
      return {
        ...nextLayout,
        fontSizePx: fontSize,
        showTooltip: false
      }
    }
  }

  return {
    ...defaultLayout,
    fontSizePx: defaultFontSizePx,
    showTooltip: true
  }
}

/** 汇总评语排版的共享常量（内边距、间距、行高比例、像素转毫米系数） */
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

/** 计算页脚块的高度（像素），取落款、班主任、署名三者字号的最大行高 */
export const getFooterBlockHeightPx = (configuration: ConfigurationType) => {
  return Math.max(
    configuration.sealFontSize * FOOTER_LINE_HEIGHT_RATIO,
    configuration.classTeacherFontSize * FOOTER_LINE_HEIGHT_RATIO,
    configuration.inscribeFontSize * FOOTER_LINE_HEIGHT_RATIO
  )
}
