import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Font as FontkitFontType } from '@pdf-lib/fontkit'

import {
  buildEvaluationPdfLayout,
  paginateEvaluationStudents
} from '@/utils/evaluationPdfLayoutUntil'
import {
  getEvaluationTextLayoutConstantsPx,
  getFooterBlockHeightPx,
  MIN_ADAPTIVE_COMMENT_FONT_SIZE_PX,
  layoutAdaptiveCommentText,
  measureBrowserTextAdvanceWidth
} from '@/utils/evaluationTextLayoutUntil'
import { getEvaluationHandwriteFontBytes } from '@/utils/evaluationHandwriteFontUntil'
import type {
  EvaluationPdfCellType,
  EvaluationPdfPageType,
  EvaluationTextPdfOptionsType,
  EvaluationTextPdfResultType
} from '@/types/EvaluationPdf'

const labelSerifFontUrl = new URL(
  '../assets/font/SourceHanSerifSC-LabelSubset.otf',
  import.meta.url
).href
const PT_PER_MM = 72 / 25.4
const PX_TO_PT = 72 / 96
const BORDER_WIDTH = 0.6
const TARGET_DASH_PT = 3.4
const TARGET_GAP_PT = 2.8
const layoutConstantsPx = getEvaluationTextLayoutConstantsPx()
const INNER_PADDING_X = layoutConstantsPx.innerPaddingX * layoutConstantsPx.pxToMm
const INNER_PADDING_Y = layoutConstantsPx.innerPaddingY * layoutConstantsPx.pxToMm
const HEADER_GAP = layoutConstantsPx.headerGap * layoutConstantsPx.pxToMm
const BODY_GAP = layoutConstantsPx.bodyGap * layoutConstantsPx.pxToMm
const FOOTER_GAP = layoutConstantsPx.footerGap * layoutConstantsPx.pxToMm

let cachedLabelSerifFontPromise: Promise<Uint8Array> | null = null
const FONT_LOAD_TIMEOUT_MS = 10000
const MIN_LABEL_FONT_SIZE_BYTES = 1024

type FooterLabelAssetType = {
  pdfFont: PDFFont
  text: string
  widthMm: number
}

type HandwriteFontAssetType = {
  pdfFont: PDFFont
  sourceFont: FontkitFontType
}

/**
 * 统一加载字体文件，并附带超时与文件完整性保护。
 * 如果后续替换字体，只需要改顶部字体 URL，不需要改这里的加载流程。
 */
const fetchFontBytes = async (url: string, fontName: string, minFontSizeBytes: number) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FONT_LOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`${fontName}字体加载失败，HTTP状态: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    clearTimeout(timeoutId)

    const bytes = new Uint8Array(buffer)
    if (bytes.length < minFontSizeBytes) {
      throw new Error(
        `${fontName}字体文件不完整，加载大小: ${bytes.length} bytes (最小需要 ${minFontSizeBytes} bytes)`
      )
    }

    return bytes
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${fontName}字体加载超时（${FONT_LOAD_TIMEOUT_MS / 1000}秒），请检查网络连接`)
    }
    throw error
  }
}

const loadLabelSerifFontBytes = async () => {
  if (!cachedLabelSerifFontPromise) {
    cachedLabelSerifFontPromise = fetchFontBytes(
      labelSerifFontUrl,
      '标签宋体',
      MIN_LABEL_FONT_SIZE_BYTES
    ).catch((error) => {
      cachedLabelSerifFontPromise = null
      throw error
    })
  }

  return cachedLabelSerifFontPromise
}

const pxToPt = (px: number) => px * PX_TO_PT
const mmToPt = (mm: number) => mm * PT_PER_MM
const pxToMm = (px: number) => px * layoutConstantsPx.pxToMm

// 业务排版统一使用“左上角毫米坐标”，真正绘制到 PDF 时再转换成左下角 pt 坐标。
const getPdfY = (pageHeightMm: number, topMm: number) => {
  return mmToPt(pageHeightMm - topMm)
}

const getLineHeightMm = (fontSizePx: number, ratio: number) => {
  return pxToMm(fontSizePx * ratio)
}

const getBaselineOffsetMm = (fontSizePx: number) => {
  return pxToMm(fontSizePx * 0.86)
}

/**
 * 手写体逐字绘制，字符推进宽度直接复用浏览器测量值。
 * 这样正文、称呼、落款在 PDF 中会尽量贴近预览效果。
 */
const drawCompactHandwriteText = (
  page: PDFPage,
  text: string,
  xMm: number,
  baselineTopMm: number,
  fontAsset: HandwriteFontAssetType,
  fontSizePx: number,
  pageHeightMm: number
) => {
  let cursorXPt = mmToPt(xMm)
  const yPt = getPdfY(pageHeightMm, baselineTopMm)
  const size = pxToPt(fontSizePx)

  Array.from(text).forEach((char) => {
    const codePoint = char.codePointAt(0)

    // 字体缺字时不填充替代符，保留原位置空白，方便用户打印后手写补齐。
    if (codePoint !== undefined && fontAsset.sourceFont.hasGlyphForCodePoint(codePoint)) {
      page.drawText(char, {
        x: cursorXPt,
        y: yPt,
        size,
        font: fontAsset.pdfFont,
        color: rgb(0, 0, 0)
      })
    }

    cursorXPt += pxToPt(measureBrowserTextAdvanceWidth(char, fontSizePx))
  })
}

// 四边虚线按边长自适应，避免评语格尺寸变化后虚线疏密不均。
const getAdaptiveDashArray = (lengthPt: number) => {
  const targetCycle = TARGET_DASH_PT + TARGET_GAP_PT
  const dashCount = Math.max(2, Math.round((lengthPt + TARGET_GAP_PT) / targetCycle))
  const scale = lengthPt / (dashCount * TARGET_DASH_PT + (dashCount - 1) * TARGET_GAP_PT)

  return [TARGET_DASH_PT * scale, TARGET_GAP_PT * scale]
}

const drawCellBorder = (page: PDFPage, cell: EvaluationPdfCellType, pageHeightMm: number) => {
  const leftX = mmToPt(cell.x)
  const rightX = mmToPt(cell.x + cell.width)
  const topY = getPdfY(pageHeightMm, cell.y)
  const bottomY = getPdfY(pageHeightMm, cell.y + cell.height)
  const horizontalDash = getAdaptiveDashArray(Math.abs(rightX - leftX))
  const verticalDash = getAdaptiveDashArray(Math.abs(topY - bottomY))

  page.drawLine({
    start: { x: leftX, y: topY },
    end: { x: rightX, y: topY },
    thickness: BORDER_WIDTH,
    color: rgb(0, 0, 0),
    dashArray: horizontalDash
  })
  page.drawLine({
    start: { x: leftX, y: bottomY },
    end: { x: rightX, y: bottomY },
    thickness: BORDER_WIDTH,
    color: rgb(0, 0, 0),
    dashArray: horizontalDash
  })
  page.drawLine({
    start: { x: leftX, y: topY },
    end: { x: leftX, y: bottomY },
    thickness: BORDER_WIDTH,
    color: rgb(0, 0, 0),
    dashArray: verticalDash
  })
  page.drawLine({
    start: { x: rightX, y: topY },
    end: { x: rightX, y: bottomY },
    thickness: BORDER_WIDTH,
    color: rgb(0, 0, 0),
    dashArray: verticalDash
  })
}

const drawCellHeader = (
  page: PDFPage,
  cell: EvaluationPdfCellType,
  startX: number,
  topY: number,
  fontSizePx: number,
  handwriteFont: HandwriteFontAssetType,
  pageHeightMm: number
) => {
  drawCompactHandwriteText(
    page,
    `${cell.studentName}同学：`,
    startX,
    topY + getBaselineOffsetMm(fontSizePx),
    handwriteFont,
    fontSizePx,
    pageHeightMm
  )

  return topY + getLineHeightMm(fontSizePx, 1.2)
}

const createFooterLabelAsset = async (
  pdfFont: PDFFont,
  text: string,
  fontSizePx: number
): Promise<FooterLabelAssetType> => {
  const fontSizePt = pxToPt(fontSizePx)

  return {
    pdfFont,
    text,
    widthMm: pdfFont.widthOfTextAtSize(text, fontSizePt) / PT_PER_MM
  }
}

const drawFooterLabelText = (
  page: PDFPage,
  asset: FooterLabelAssetType,
  textXPt: number,
  baselineYPt: number,
  fontSizePx: number
) => {
  page.drawText(asset.text, {
    x: textXPt,
    y: baselineYPt,
    size: pxToPt(fontSizePx),
    font: asset.pdfFont,
    color: rgb(0, 0, 0)
  })
}

/**
 * 页脚由左标签、右标签和手写落款三部分组成。
 * 右侧标签的位置需要先扣掉落款宽度，才能保证整段内容右对齐。
 */
const drawCellFooter = (
  page: PDFPage,
  cell: EvaluationPdfCellType,
  startX: number,
  topY: number,
  sealFontSizePx: number,
  classTeacherFontSizePx: number,
  inscribeFontSizePx: number,
  inscribe: string,
  footerLeftAsset: FooterLabelAssetType,
  footerRightAsset: FooterLabelAssetType,
  handwriteFont: HandwriteFontAssetType,
  pageHeightMm: number
) => {
  const footerLineTopY = topY
  const inscribeBaselineTopMm = footerLineTopY + getBaselineOffsetMm(inscribeFontSizePx)
  const inscribeText = inscribe || ' '
  const sealBaselineTopMm = footerLineTopY + getBaselineOffsetMm(sealFontSizePx)
  const footerLeftXPt = mmToPt(startX)
  const sealBaselinePt = getPdfY(pageHeightMm, sealBaselineTopMm)

  drawFooterLabelText(page, footerLeftAsset, footerLeftXPt, sealBaselinePt, sealFontSizePx)

  const inscribeWidthMm = pxToMm(measureBrowserTextAdvanceWidth(inscribeText, inscribeFontSizePx))
  const footerRightX =
    cell.x + cell.width - INNER_PADDING_X - footerRightAsset.widthMm - inscribeWidthMm
  const classTeacherBaselineTopMm = footerLineTopY + getBaselineOffsetMm(classTeacherFontSizePx)
  const footerRightXPt = mmToPt(footerRightX)
  const classTeacherBaselinePt = getPdfY(pageHeightMm, classTeacherBaselineTopMm)

  drawFooterLabelText(
    page,
    footerRightAsset,
    footerRightXPt,
    classTeacherBaselinePt,
    classTeacherFontSizePx
  )

  drawCompactHandwriteText(
    page,
    inscribeText,
    footerRightX + footerRightAsset.widthMm,
    inscribeBaselineTopMm,
    handwriteFont,
    inscribeFontSizePx,
    pageHeightMm
  )
}

/**
 * 正文排版完全复用共享自适应排版引擎，与页面预览保持所见即所得。
 * 后续若要调整行高、首行缩进、截断规则，优先改 `evaluationTextLayoutUntil.ts`。
 */
const drawCellComment = (
  page: PDFPage,
  cell: EvaluationPdfCellType,
  startX: number,
  bodyTopY: number,
  bodyWidth: number,
  bodyHeight: number,
  textFontSizePx: number,
  handwriteFont: HandwriteFontAssetType,
  pageHeightMm: number
) => {
  const layout = layoutAdaptiveCommentText(
    cell.comment,
    textFontSizePx,
    MIN_ADAPTIVE_COMMENT_FONT_SIZE_PX,
    bodyWidth / layoutConstantsPx.pxToMm,
    bodyHeight / layoutConstantsPx.pxToMm
  )
  const baselineOffset = getBaselineOffsetMm(layout.fontSizePx)
  const bodyLineHeight = pxToMm(layout.lineHeightPx)
  const indentWidth = pxToMm(layout.indentWidthPx)

  layout.lines.forEach((line, index) => {
    const x = line.indent ? startX + indentWidth : startX
    drawCompactHandwriteText(
      page,
      line.text,
      x,
      bodyTopY + index * bodyLineHeight + baselineOffset,
      handwriteFont,
      layout.fontSizePx,
      pageHeightMm
    )
  })

  return layout.truncated
}

// 单页绘制顺序固定为：边框 -> 称呼 -> 正文 -> 页脚，方便后续定位布局问题。
const drawEvaluationPage = (
  page: PDFPage,
  pageData: EvaluationPdfPageType,
  configuration: EvaluationTextPdfOptionsType['configuration'],
  handwriteFont: HandwriteFontAssetType,
  footerLeftAsset: FooterLabelAssetType,
  footerRightAsset: FooterLabelAssetType,
  pageHeightMm: number
) => {
  const truncatedStudents: string[] = []

  pageData.cells.forEach((cell) => {
    drawCellBorder(page, cell, pageHeightMm)

    const startX = cell.x + INNER_PADDING_X
    let cursorTopY = cell.y + INNER_PADDING_Y

    cursorTopY = drawCellHeader(
      page,
      cell,
      startX,
      cursorTopY,
      configuration.salutationFontSize,
      handwriteFont,
      pageHeightMm
    )
    const bodyTopY = cursorTopY + HEADER_GAP

    const footerBlockHeight = pxToMm(getFooterBlockHeightPx(configuration))
    const footerTopY = cell.y + cell.height - INNER_PADDING_Y - footerBlockHeight
    const bodyWidth = cell.width - INNER_PADDING_X * 2
    const bodyHeight = Math.max(4, footerTopY - FOOTER_GAP - BODY_GAP - bodyTopY)

    const isTruncated = drawCellComment(
      page,
      cell,
      startX,
      bodyTopY,
      bodyWidth,
      bodyHeight,
      configuration.textFontSize,
      handwriteFont,
      pageHeightMm
    )

    if (isTruncated) {
      truncatedStudents.push(cell.studentName)
    }

    drawCellFooter(
      page,
      cell,
      startX,
      footerTopY,
      configuration.sealFontSize,
      configuration.classTeacherFontSize,
      configuration.inscribeFontSize,
      configuration.inscribe,
      footerLeftAsset,
      footerRightAsset,
      handwriteFont,
      pageHeightMm
    )
  })

  return truncatedStudents
}

const getDefaultFileName = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')

  return `期末评语_${year}${month}${day}_${hour}${minute}${second}.pdf`
}

const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

// 浏览器环境下统一从这里触发下载，后续若切到桌面端存盘，可直接替换这一层。
const downloadPdfBytes = (bytes: Uint8Array, fileName: string) => {
  const blobBytes = new Uint8Array(bytes)
  const blob = new Blob([blobBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export const exportEvaluationTextPDF = async (
  options: EvaluationTextPdfOptionsType
): Promise<EvaluationTextPdfResultType> => {
  try {
    // 预览和导出共用同一套毫米制布局，避免页面看着正常、导出尺寸却跑偏。
    const layout = buildEvaluationPdfLayout(options.configuration)
    const pages = paginateEvaluationStudents(options.students, layout)

    if (!pages.length) {
      return {
        success: false,
        truncatedStudents: [],
        error: new Error('没有可导出的评语数据')
      }
    }

    // 手写字体来源统一走字体管理工具：用户上传字体优先，否则使用默认内置字体。
    const [handwriteFontBytes, labelSerifFontBytes] = await Promise.all([
      getEvaluationHandwriteFontBytes(),
      loadLabelSerifFontBytes()
    ])

    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)

    // 手写正文使用 subset 控制体积；标签字体本身只有约 16KB，完整嵌入可避免
    // CJK 子集 OTF 在部分 PDF 查看器中被错误映射成 ASCII 字符。
    const handwriteFont: HandwriteFontAssetType = {
      pdfFont: await pdfDoc.embedFont(handwriteFontBytes, { subset: true }),
      sourceFont: fontkit.create(handwriteFontBytes)
    }
    const labelSerifPdfFont = await pdfDoc.embedFont(labelSerifFontBytes, { subset: false })
    const [footerLeftAsset, footerRightAsset] = await Promise.all([
      createFooterLabelAsset(
        labelSerifPdfFont,
        '学校：（章）',
        options.configuration.sealFontSize
      ),
      createFooterLabelAsset(
        labelSerifPdfFont,
        '班主任：',
        options.configuration.classTeacherFontSize
      )
    ])

    const truncatedStudents: string[] = []
    pages.forEach((pageData) => {
      const page = pdfDoc.addPage([mmToPt(layout.pageWidth), mmToPt(layout.pageHeight)])
      truncatedStudents.push(
        ...drawEvaluationPage(
          page,
          pageData,
          options.configuration,
          handwriteFont,
          footerLeftAsset,
          footerRightAsset,
          layout.pageHeight
        )
      )
    })

    const fileName = options.fileName || getDefaultFileName()
    const bytes = await pdfDoc.save()
    downloadPdfBytes(bytes, fileName)

    return {
      success: true,
      truncatedStudents: uniq(truncatedStudents)
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('导出失败')
    console.error('文字版 PDF 导出失败:', error)

    return {
      success: false,
      truncatedStudents: [],
      error
    }
  }
}
