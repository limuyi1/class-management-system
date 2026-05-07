import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Font as FontkitFontType, GlyphRun as FontkitGlyphRunType } from '@pdf-lib/fontkit'

import {
  buildEvaluationPdfLayout,
  paginateEvaluationStudents
} from '@/utils/evaluationPdfLayoutUntil'
import {
  getEvaluationTextLayoutConstantsPx,
  getFooterBlockHeightPx,
  layoutCommentText,
  measureBrowserTextAdvanceWidth
} from '@/utils/evaluationTextLayoutUntil'
import type {
  EvaluationPdfCellType,
  EvaluationPdfPageType,
  EvaluationTextPdfOptionsType,
  EvaluationTextPdfResultType
} from '@/types/EvaluationPdf'

const handwriteFontUrl = new URL('../assets/font/fuyao-shoushu.ttf', import.meta.url).href
const songtiFontUrl = new URL('../assets/font/SourceHanSerifSC-Regular.otf', import.meta.url).href
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

let cachedHandwriteFontPromise: Promise<Uint8Array> | null = null
let cachedSongtiFontPromise: Promise<Uint8Array> | null = null
const FONT_LOAD_TIMEOUT_MS = 10000
const MIN_FONT_SIZE_BYTES = 1024 * 1024

// 页脚固定标签不直接嵌入整套宋体，而是缓存成可复用的字形排版结果。
type FooterLabelAssetType = {
  glyphRun: FontkitGlyphRunType
  unitsPerEm: number
  widthMm: number
}

// fontkit 需要一个接收 path 指令的“画笔对象”，显式定义后更方便后续手改维护。
type PathCommandRecorderType = {
  commands: string[]
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ) => void
  closePath: () => void
}

/**
 * 统一加载字体文件，并附带超时与文件完整性保护。
 * 如果后续替换字体，只需要改顶部字体 URL，不需要改这里的加载流程。
 */
const fetchFontBytes = async (url: string, fontName: string) => {
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
    if (bytes.length < MIN_FONT_SIZE_BYTES) {
      throw new Error(
        `${fontName}字体文件不完整，加载大小: ${bytes.length} bytes (最小需要 ${MIN_FONT_SIZE_BYTES} bytes)`
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

const loadHandwriteFontBytes = async () => {
  if (!cachedHandwriteFontPromise) {
    cachedHandwriteFontPromise = fetchFontBytes(handwriteFontUrl, '手写体').catch((error) => {
      cachedHandwriteFontPromise = null
      throw error
    })
  }

  return cachedHandwriteFontPromise
}

const loadSongtiFontBytes = async () => {
  if (!cachedSongtiFontPromise) {
    cachedSongtiFontPromise = fetchFontBytes(songtiFontUrl, '宋体').catch((error) => {
      cachedSongtiFontPromise = null
      throw error
    })
  }

  return cachedSongtiFontPromise
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
  font: PDFFont,
  fontSizePx: number,
  pageHeightMm: number
) => {
  let cursorXPt = mmToPt(xMm)
  const yPt = getPdfY(pageHeightMm, baselineTopMm)
  const size = pxToPt(fontSizePx)

  Array.from(text).forEach((char) => {
    page.drawText(char, {
      x: cursorXPt,
      y: yPt,
      size,
      font,
      color: rgb(0, 0, 0)
    })
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
  handwriteFont: PDFFont,
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
  font: FontkitFontType,
  text: string,
  fontSizePx: number
): Promise<FooterLabelAssetType> => {
  // 这里提前算好字形和总宽度，后续每个单元格可直接复用。
  const glyphRun = font.layout(text)
  const fontSizePt = pxToPt(fontSizePx)
  const widthPt =
    glyphRun.positions.reduce((total, position) => total + position.xAdvance, 0) *
    (fontSizePt / font.unitsPerEm)

  return {
    glyphRun,
    unitsPerEm: font.unitsPerEm,
    widthMm: widthPt / PT_PER_MM
  }
}

/**
 * 将 fontkit 字形路径转换成 pdf-lib 可绘制的 SVG path。
 * pdf-lib 绘制 SVG 时内部会翻转一次 Y 轴，这里先手动抵消，避免页脚文字倒置。
 */
const getPdfCompatibleSvgPath = (glyphRun: FontkitGlyphRunType['glyphs'][number]) => {
  const recorder: PathCommandRecorderType = {
    commands: [],
    moveTo: (x, y) => recorder.commands.push(`M${x} ${-y}`),
    lineTo: (x, y) => recorder.commands.push(`L${x} ${-y}`),
    quadraticCurveTo: (cpx, cpy, x, y) => recorder.commands.push(`Q${cpx} ${-cpy} ${x} ${-y}`),
    bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) =>
      recorder.commands.push(`C${cp1x} ${-cp1y} ${cp2x} ${-cp2y} ${x} ${-y}`),
    closePath: () => recorder.commands.push('Z')
  }

  // pdf-lib 在绘制 SVG path 时会额外翻转 Y 轴，这里先把字形坐标转成兼容方向，避免页脚文字倒置。
  glyphRun.path.toFunction().call(recorder, recorder)

  return recorder.commands.join('')
}

// 固定标签绘制为矢量路径，既能保持清晰，又避免 PDF 体积因为整套宋体嵌入而膨胀。
const drawFooterLabelVector = (
  page: PDFPage,
  asset: FooterLabelAssetType,
  textXPt: number,
  baselineYPt: number,
  fontSizePx: number
) => {
  const scale = pxToPt(fontSizePx) / asset.unitsPerEm
  let cursorX = textXPt

  asset.glyphRun.glyphs.forEach((glyph, index) => {
    const position = asset.glyphRun.positions[index]
    const svgPath = getPdfCompatibleSvgPath(glyph)

    if (svgPath) {
      page.drawSvgPath(svgPath, {
        x: cursorX + position.xOffset * scale,
        y: baselineYPt - position.yOffset * scale,
        scale,
        color: rgb(0, 0, 0)
      })
    }

    cursorX += position.xAdvance * scale
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
  handwriteFont: PDFFont,
  pageHeightMm: number
) => {
  const footerLineTopY = topY
  const inscribeBaselineTopMm = footerLineTopY + getBaselineOffsetMm(inscribeFontSizePx)
  const inscribeText = inscribe || ' '
  const sealBaselineTopMm = footerLineTopY + getBaselineOffsetMm(sealFontSizePx)
  const footerLeftXPt = mmToPt(startX)
  const sealBaselinePt = getPdfY(pageHeightMm, sealBaselineTopMm)

  drawFooterLabelVector(page, footerLeftAsset, footerLeftXPt, sealBaselinePt, sealFontSizePx)

  const inscribeWidthMm = pxToMm(measureBrowserTextAdvanceWidth(inscribeText, inscribeFontSizePx))
  const footerRightX =
    cell.x + cell.width - INNER_PADDING_X - footerRightAsset.widthMm - inscribeWidthMm
  const classTeacherBaselineTopMm = footerLineTopY + getBaselineOffsetMm(classTeacherFontSizePx)
  const footerRightXPt = mmToPt(footerRightX)
  const classTeacherBaselinePt = getPdfY(pageHeightMm, classTeacherBaselineTopMm)

  drawFooterLabelVector(
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
 * 正文排版完全复用共享排版引擎。
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
  handwriteFont: PDFFont,
  pageHeightMm: number
) => {
  const layout = layoutCommentText(
    cell.comment,
    textFontSizePx,
    bodyWidth / layoutConstantsPx.pxToMm,
    bodyHeight / layoutConstantsPx.pxToMm
  )
  const baselineOffset = getBaselineOffsetMm(textFontSizePx)
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
      textFontSizePx,
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
  handwriteFont: PDFFont,
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

    const [handwriteFontBytes, songtiFontBytes] = await Promise.all([
      loadHandwriteFontBytes(),
      loadSongtiFontBytes()
    ])

    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)

    // 正文仍使用 subset 控制体积；页脚固定标签改为矢量路径，因此无需再嵌入整套宋体。
    const handwriteFont = await pdfDoc.embedFont(handwriteFontBytes, { subset: true })
    const songtiVectorFont = fontkit.create(songtiFontBytes)
    const [footerLeftAsset, footerRightAsset] = await Promise.all([
      createFooterLabelAsset(songtiVectorFont, '学校：（章）', options.configuration.sealFontSize),
      createFooterLabelAsset(
        songtiVectorFont,
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
