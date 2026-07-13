import domtoimage from 'dom-to-image'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib'

import { PagesEnum } from '@/types/Common'
import {
  SeatingSpecialSeatPositionEnum,
  SeatingViewDirectionEnum,
  type SeatPositionType,
  type SeatingChartType
} from '@/types/SeatingChart'
import { buildSeatingChartPdfLayout } from '@/utils/seatingChartPdfLayoutUntil'
import { getVisibleSeats } from '@/utils/seatingChartUntil'

export type SeatingChartExportFormatType = 'png' | 'pdf'

export interface SeatingChartPdfOptionsType {
  chart: SeatingChartType
  studentNames: Record<string, string>
  showEmptyLabels: boolean
  pageType: PagesEnum
}

const seatingChartFontUrl = new URL('../assets/font/SourceHanSerifSC-Regular.otf', import.meta.url)
  .href
let seatingChartFontPromise: Promise<Uint8Array> | null = null

export function sanitizeSeatingChartFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || '座位表'
}

export function formatSeatingChartExportDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 按导出模板的自然尺寸生成高清 PNG，避免受到编辑画布滚动和缩放状态影响。
 */
export async function renderSeatingChartPngBlob(element: HTMLElement, scale = 2): Promise<Blob> {
  await document.fonts?.ready
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (!width || !height) throw new Error('座位表预览尚未准备完成')

  const dataUrl = await domtoimage.toPng(element, {
    quality: 1,
    bgcolor: '#f4f0e8',
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    style: {
      transform: `scale(${scale})`,
      transformOrigin: '0 0'
    }
  })
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('座位表图片生成失败')
  return await response.blob()
}

async function loadSeatingChartFontBytes(): Promise<Uint8Array> {
  if (!seatingChartFontPromise) {
    seatingChartFontPromise = fetch(seatingChartFontUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error('座位表中文字体加载失败')
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.length < 1024 * 1024) throw new Error('座位表中文字体文件不完整')
        return bytes
      })
      .catch((error) => {
        seatingChartFontPromise = null
        throw error
      })
  }
  return seatingChartFontPromise
}

function toPdfY(pageHeight: number, top: number, height = 0): number {
  return pageHeight - top - height
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  top: number,
  size: number,
  color = rgb(0.16, 0.14, 0.18)
): void {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, {
    x: centerX - width / 2,
    y: toPdfY(page.getHeight(), top, size),
    size,
    font,
    color
  })
}

function fitFontSize(font: PDFFont, text: string, maxWidth: number, preferred: number): number {
  let size = preferred
  while (size > 5.5 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5
  return size
}

function drawSeatText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  top: number,
  width: number,
  height: number,
  preferredSize: number,
  color = rgb(0.16, 0.14, 0.18)
): void {
  const maxWidth = width - 8
  const size = fitFontSize(font, text, maxWidth, preferredSize)
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    drawCenteredText(page, font, text, x + width / 2, top + (height - size) / 2 - 1, size, color)
    return
  }

  const characters = Array.from(text)
  const splitIndex = Math.ceil(characters.length / 2)
  const lines = [characters.slice(0, splitIndex).join(''), characters.slice(splitIndex).join('')]
  const lineSize = Math.max(5.5, Math.min(size, height * 0.26))
  const lineHeight = lineSize * 1.18
  const firstTop = top + (height - lineHeight * 2) / 2
  lines.forEach((line, index) => {
    drawCenteredText(
      page,
      font,
      line,
      x + width / 2,
      firstTop + index * lineHeight,
      lineSize,
      color
    )
  })
}

function groupVisibleSeatRows(chart: SeatingChartType): SeatPositionType[][] {
  const rows: SeatPositionType[][] = []
  getVisibleSeats(chart).forEach((seat) => {
    const currentRow = rows[rows.length - 1]
    if (!currentRow || currentRow[0].row !== seat.row) rows.push([seat])
    else currentRow.push(seat)
  })
  return rows
}

/**
 * 使用文字和矢量图形直接绘制座位表 PDF，保证姓名可选择、可搜索，缩放不失真。
 */
export async function createSeatingChartPdf(options: SeatingChartPdfOptionsType): Promise<Blob> {
  const layout = buildSeatingChartPdfLayout(options.chart, options.pageType)
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  // CJK OTF 动态子集在部分 PDF 查看器中会发生字符映射错乱，完整嵌入保证姓名正确显示和复制。
  const font = await pdfDoc.embedFont(await loadSeatingChartFontBytes(), { subset: false })
  const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight])
  const ink = rgb(0.16, 0.14, 0.18)
  const muted = rgb(0.48, 0.44, 0.5)
  const accent = rgb(0.36, 0.25, 0.49)
  const line = rgb(0.82, 0.79, 0.84)

  page.drawRectangle({
    x: 0,
    y: 0,
    width: layout.pageWidth,
    height: layout.pageHeight,
    color: rgb(1, 1, 1)
  })
  const titleSize = fitFontSize(font, options.chart.name, layout.pageWidth - layout.margin * 2, 20)
  drawCenteredText(
    page,
    font,
    options.chart.name,
    layout.pageWidth / 2,
    layout.titleTop,
    titleSize,
    ink
  )
  page.drawLine({
    start: { x: layout.margin, y: toPdfY(layout.pageHeight, layout.dividerTop) },
    end: { x: layout.pageWidth - layout.margin, y: toPdfY(layout.pageHeight, layout.dividerTop) },
    thickness: 1.2,
    color: ink
  })

  const specialGap = 8 * layout.fontScale
  const platformGroupWidth = layout.platformWidth + layout.specialSeatWidth * 2 + specialGap * 2
  const platformGroupLeft = (layout.pageWidth - platformGroupWidth) / 2
  const facingStudents = options.chart.viewDirection === SeatingViewDirectionEnum.FacingStudents
  const platformLeftPosition = facingStudents
    ? SeatingSpecialSeatPositionEnum.PlatformRight
    : SeatingSpecialSeatPositionEnum.PlatformLeft
  const platformRightPosition = facingStudents
    ? SeatingSpecialSeatPositionEnum.PlatformLeft
    : SeatingSpecialSeatPositionEnum.PlatformRight

  const drawSpecialSeat = (position: SeatingSpecialSeatPositionEnum, x: number): void => {
    const seat = options.chart.specialSeats.find((item) => item.position === position)
    if (!seat?.enabled) return
    page.drawRectangle({
      x,
      y: toPdfY(layout.pageHeight, layout.platformTop, layout.platformHeight),
      width: layout.specialSeatWidth,
      height: layout.platformHeight,
      color: rgb(1, 0.98, 0.91),
      borderColor: rgb(0.8, 0.72, 0.52),
      borderWidth: 0.8
    })
    const name = seat.studentId
      ? options.studentNames[seat.studentId] || '未命名学生'
      : options.showEmptyLabels
        ? '空座位'
        : ''
    if (name) {
      drawSeatText(
        page,
        font,
        name,
        x,
        layout.platformTop,
        layout.specialSeatWidth,
        layout.platformHeight,
        8.5 * Math.min(1, layout.fontScale),
        ink
      )
    }
  }

  drawSpecialSeat(platformLeftPosition, platformGroupLeft)
  const platformLeft = platformGroupLeft + layout.specialSeatWidth + specialGap
  page.drawRectangle({
    x: platformLeft,
    y: toPdfY(layout.pageHeight, layout.platformTop, layout.platformHeight),
    width: layout.platformWidth,
    height: layout.platformHeight,
    color: ink
  })
  drawCenteredText(
    page,
    font,
    '讲 台',
    platformLeft + layout.platformWidth / 2,
    layout.platformTop + (layout.platformHeight - 11) / 2 - 1,
    11,
    rgb(1, 1, 1)
  )
  drawSpecialSeat(platformRightPosition, platformLeft + layout.platformWidth + specialGap)

  const visibleRows = groupVisibleSeatRows(options.chart)
  const columnSeats = visibleRows[0] || []
  const hasAisleAfterSeat = (seat: SeatPositionType): boolean => {
    const aisleColumn = facingStudents ? seat.column - 1 : seat.column
    return options.chart.aisleAfterColumns.includes(aisleColumn)
  }
  let columnX = layout.gridLeft + layout.rowHeaderWidth + layout.seatGap
  columnSeats.forEach((seat) => {
    page.drawRectangle({
      x: columnX,
      y: toPdfY(layout.pageHeight, layout.gridTop, layout.columnHeaderHeight),
      width: layout.seatWidth,
      height: layout.columnHeaderHeight,
      color: accent
    })
    drawCenteredText(
      page,
      font,
      `${seat.column + 1}列`,
      columnX + layout.seatWidth / 2,
      layout.gridTop + (layout.columnHeaderHeight - 8) / 2 - 1,
      Math.max(5.5, 8 * Math.min(1, layout.fontScale)),
      rgb(1, 1, 1)
    )
    columnX += layout.seatWidth
    if (hasAisleAfterSeat(seat)) columnX += layout.aisleWidth
    columnX += layout.seatGap
  })

  let rowTop = layout.gridTop + layout.columnHeaderHeight + layout.seatGap
  visibleRows.forEach((row) => {
    page.drawRectangle({
      x: layout.gridLeft,
      y: toPdfY(layout.pageHeight, rowTop, layout.seatHeight),
      width: layout.rowHeaderWidth,
      height: layout.seatHeight,
      color: accent
    })
    drawCenteredText(
      page,
      font,
      `${row[0].row + 1}排`,
      layout.gridLeft + layout.rowHeaderWidth / 2,
      rowTop + (layout.seatHeight - 7.5) / 2 - 1,
      Math.max(5.5, 7.5 * Math.min(1, layout.fontScale)),
      rgb(1, 1, 1)
    )

    let seatX = layout.gridLeft + layout.rowHeaderWidth + layout.seatGap
    row.forEach((seat) => {
      page.drawRectangle({
        x: seatX,
        y: toPdfY(layout.pageHeight, rowTop, layout.seatHeight),
        width: layout.seatWidth,
        height: layout.seatHeight,
        color: seat.studentId ? rgb(1, 1, 1) : rgb(0.985, 0.98, 0.99),
        borderColor: seat.studentId ? rgb(0.55, 0.48, 0.57) : line,
        borderWidth: seat.studentId ? 1 : 0.55
      })
      const text = seat.studentId
        ? options.studentNames[seat.studentId] || '未命名学生'
        : options.showEmptyLabels
          ? '空座位'
          : ''
      if (text) {
        drawSeatText(
          page,
          font,
          text,
          seatX,
          rowTop,
          layout.seatWidth,
          layout.seatHeight,
          9.5 * Math.min(1, layout.fontScale),
          seat.studentId ? ink : muted
        )
      }
      seatX += layout.seatWidth
      if (hasAisleAfterSeat(seat)) {
        page.drawRectangle({
          x: seatX,
          y: toPdfY(layout.pageHeight, rowTop, layout.seatHeight),
          width: layout.aisleWidth,
          height: layout.seatHeight,
          color: rgb(0.95, 0.93, 0.98),
          borderColor: rgb(0.82, 0.77, 0.89),
          borderWidth: 0.4
        })
        seatX += layout.aisleWidth
      }
      seatX += layout.seatGap
    })
    rowTop += layout.seatHeight + layout.seatGap
  })

  const bytes = await pdfDoc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export function downloadSeatingChartBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
