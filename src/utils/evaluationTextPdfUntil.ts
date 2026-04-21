import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

import { buildEvaluationPdfLayout, paginateEvaluationStudents } from '@/utils/evaluationPdfLayoutUntil'
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

// 两套字体分别承担不同语义：正文/称呼/落款使用手写体，页脚标签使用宋体。
const fetchFontBytes = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('字体加载失败')
  }

  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

const loadHandwriteFontBytes = async () => {
  if (!cachedHandwriteFontPromise) {
    cachedHandwriteFontPromise = fetchFontBytes(handwriteFontUrl).catch((error) => {
      cachedHandwriteFontPromise = null
      throw error
    })
  }

  return cachedHandwriteFontPromise
}

const loadSongtiFontBytes = async () => {
  if (!cachedSongtiFontPromise) {
    cachedSongtiFontPromise = fetchFontBytes(songtiFontUrl).catch((error) => {
      cachedSongtiFontPromise = null
      throw error
    })
  }

  return cachedSongtiFontPromise
}

const pxToPt = (px: number) => px * PX_TO_PT
const mmToPt = (mm: number) => mm * PT_PER_MM
const pxToMm = (px: number) => px * layoutConstantsPx.pxToMm

// pdf-lib 使用左下角为原点，这里统一把“从页面顶部开始的毫米坐标”转换成 PDF 坐标。
const getPdfY = (pageHeightMm: number, topMm: number) => {
  return mmToPt(pageHeightMm - topMm)
}

const getLineHeightMm = (fontSizePx: number, ratio: number) => {
  return pxToMm(fontSizePx * ratio)
}

const getBaselineOffsetMm = (fontSizePx: number) => {
  return pxToMm(fontSizePx * 0.86)
}

const drawCompactHandwriteText = (
  page: PDFPageType,
  text: string,
  xMm: number,
  baselineTopMm: number,
  font: PDFFontType,
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

type PDFFontType = Awaited<ReturnType<typeof PDFDocument.create>> extends infer T
  ? T extends PDFDocument
    ? Awaited<ReturnType<T['embedFont']>>
    : never
  : never

type PDFPageType = ReturnType<PDFDocument['addPage']>

// 逐边自适应虚线，避免固定 dashArray 在不同边长下出现“有的密有的疏”。
const getAdaptiveDashArray = (lengthPt: number) => {
  const targetCycle = TARGET_DASH_PT + TARGET_GAP_PT
  const dashCount = Math.max(2, Math.round((lengthPt + TARGET_GAP_PT) / targetCycle))
  const scale = lengthPt / (dashCount * TARGET_DASH_PT + (dashCount - 1) * TARGET_GAP_PT)

  return [TARGET_DASH_PT * scale, TARGET_GAP_PT * scale]
}

const drawCellBorder = (page: PDFPageType, cell: EvaluationPdfCellType, pageHeightMm: number) => {
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
  page: PDFPageType,
  cell: EvaluationPdfCellType,
  startX: number,
  topY: number,
  fontSizePx: number,
  handwriteFont: PDFFontType,
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

const drawCellFooter = (
  page: PDFPageType,
  cell: EvaluationPdfCellType,
  startX: number,
  topY: number,
  sealFontSizePx: number,
  classTeacherFontSizePx: number,
  inscribeFontSizePx: number,
  inscribe: string,
  songtiFont: PDFFontType,
  handwriteFont: PDFFontType,
  pageHeightMm: number
) => {
  const footerLeftText = '学校：（章）'
  const footerRightLabel = '班主任：'
  const footerLineTopY = topY
  const sealBaselineTopMm = footerLineTopY + getBaselineOffsetMm(sealFontSizePx)
  const classTeacherBaselineTopMm = footerLineTopY + getBaselineOffsetMm(classTeacherFontSizePx)
  const inscribeBaselineTopMm = footerLineTopY + getBaselineOffsetMm(inscribeFontSizePx)
  const inscribeText = inscribe || ' '

  page.drawText(footerLeftText, {
    x: mmToPt(startX),
    y: getPdfY(pageHeightMm, sealBaselineTopMm),
    size: pxToPt(sealFontSizePx),
    font: songtiFont,
    color: rgb(0, 0, 0)
  })

  const footerRightWidthMm =
    songtiFont.widthOfTextAtSize(footerRightLabel, pxToPt(classTeacherFontSizePx)) / PT_PER_MM
  const inscribeWidthMm = pxToMm(measureBrowserTextAdvanceWidth(inscribeText, inscribeFontSizePx))
  const footerRightX = cell.x + cell.width - INNER_PADDING_X - footerRightWidthMm - inscribeWidthMm

  page.drawText(footerRightLabel, {
    x: mmToPt(footerRightX),
    y: getPdfY(pageHeightMm, classTeacherBaselineTopMm),
    size: pxToPt(classTeacherFontSizePx),
    font: songtiFont,
    color: rgb(0, 0, 0)
  })

  drawCompactHandwriteText(
    page,
    inscribeText,
    footerRightX + footerRightWidthMm,
    inscribeBaselineTopMm,
    handwriteFont,
    inscribeFontSizePx,
    pageHeightMm
  )
}

const drawCellComment = (
  page: PDFPageType,
  cell: EvaluationPdfCellType,
  startX: number,
  bodyTopY: number,
  bodyWidth: number,
  bodyHeight: number,
  textFontSizePx: number,
  handwriteFont: PDFFontType,
  pageHeightMm: number
) => {
  // PDF 正文直接复用共享排版引擎的结果，确保与预览的换行、缩进、截断一致。
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

const drawEvaluationPage = (
  page: PDFPageType,
  pageData: EvaluationPdfPageType,
  configuration: EvaluationTextPdfOptionsType['configuration'],
  handwriteFont: PDFFontType,
  songtiFont: PDFFontType,
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

    // 页脚标签是宋体真文字，落款名字仍然保留手写体，贴近实际盖章/签名场景。
    drawCellFooter(
      page,
      cell,
      startX,
      footerTopY,
      configuration.sealFontSize,
      configuration.classTeacherFontSize,
      configuration.inscribeFontSize,
      configuration.inscribe,
      songtiFont,
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

const downloadPdfBytes = (bytes: Uint8Array, fileName: string) => {
  const blob = new Blob([bytes], { type: 'application/pdf' })
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

    const handwriteFont = await pdfDoc.embedFont(handwriteFontBytes, { subset: true })
    const songtiFont = await pdfDoc.embedFont(songtiFontBytes, { subset: true })

    const truncatedStudents: string[] = []
    pages.forEach((pageData) => {
      const page = pdfDoc.addPage([mmToPt(layout.pageWidth), mmToPt(layout.pageHeight)])
      truncatedStudents.push(
        ...drawEvaluationPage(page, pageData, options.configuration, handwriteFont, songtiFont, layout.pageHeight)
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
