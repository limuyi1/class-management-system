import { PagesEnum } from '@/types/Common'
import type { SeatingChartType } from '@/types/SeatingChart'

export interface SeatingChartPdfSizeType {
  width: number
  height: number
}

export interface SeatingChartPdfLayoutType {
  pageWidth: number
  pageHeight: number
  margin: number
  titleTop: number
  titleHeight: number
  dividerTop: number
  gridTop: number
  gridLeft: number
  gridWidth: number
  gridHeight: number
  rowHeaderWidth: number
  columnHeaderHeight: number
  seatWidth: number
  seatHeight: number
  seatGap: number
  aisleWidth: number
  platformTop: number
  platformWidth: number
  platformHeight: number
  specialSeatWidth: number
  platformGap: number
  fontScale: number
}

const PDF_PAGE_SIZE: Record<PagesEnum, SeatingChartPdfSizeType> = {
  [PagesEnum.A4]: { width: 595.28, height: 841.89 },
  [PagesEnum.A3]: { width: 841.89, height: 1190.55 },
  [PagesEnum.B4]: { width: 708.66, height: 1000.63 },
  [PagesEnum.B3]: { width: 1000.63, height: 1417.32 }
}

const BASE_SEAT_WIDTH = 62
const BASE_SEAT_HEIGHT = 36
const BASE_SEAT_GAP = 5
const BASE_AISLE_WIDTH = 18
const BASE_ROW_HEADER_WIDTH = 22
const BASE_COLUMN_HEADER_HEIGHT = 20
const BASE_PLATFORM_HEIGHT = 38
const BASE_PLATFORM_GAP = 18

/**
 * 计算横向单页座位表布局。全部坐标以 PDF 页面左上角为原点，绘制时再转换坐标系。
 */
export function buildSeatingChartPdfLayout(
  chart: SeatingChartType,
  pageType: PagesEnum
): SeatingChartPdfLayoutType {
  const portrait = PDF_PAGE_SIZE[pageType]
  const pageWidth = portrait.height
  const pageHeight = portrait.width
  const margin = pageType === PagesEnum.A3 || pageType === PagesEnum.B3 ? 38 : 28
  const titleTop = margin
  const titleHeight = 28
  const dividerTop = titleTop + titleHeight + 8
  const contentTop = dividerTop + 14
  const footerReserve = 18
  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - contentTop - margin - footerReserve

  const naturalGridWidth =
    BASE_ROW_HEADER_WIDTH +
    BASE_SEAT_GAP +
    chart.columns * BASE_SEAT_WIDTH +
    Math.max(0, chart.columns - 1) * BASE_SEAT_GAP +
    chart.aisleAfterColumns.length * BASE_AISLE_WIDTH
  const naturalGridHeight =
    BASE_COLUMN_HEADER_HEIGHT +
    BASE_SEAT_GAP +
    chart.rows * BASE_SEAT_HEIGHT +
    Math.max(0, chart.rows - 1) * BASE_SEAT_GAP
  const naturalClassroomHeight = naturalGridHeight + BASE_PLATFORM_GAP + BASE_PLATFORM_HEIGHT
  const maximumScale = pageType === PagesEnum.A3 || pageType === PagesEnum.B3 ? 1.45 : 1.2
  const scale = Math.min(
    maximumScale,
    availableWidth / naturalGridWidth,
    availableHeight / naturalClassroomHeight
  )

  const rowHeaderWidth = BASE_ROW_HEADER_WIDTH * scale
  const columnHeaderHeight = BASE_COLUMN_HEADER_HEIGHT * scale
  const seatWidth = BASE_SEAT_WIDTH * scale
  const seatHeight = BASE_SEAT_HEIGHT * scale
  const seatGap = BASE_SEAT_GAP * scale
  const aisleWidth = BASE_AISLE_WIDTH * scale
  const platformHeight = BASE_PLATFORM_HEIGHT * scale
  const platformGap = BASE_PLATFORM_GAP * scale
  const gridWidth = naturalGridWidth * scale
  const gridHeight = naturalGridHeight * scale
  const classroomHeight = gridHeight + platformGap + platformHeight
  const classroomTop = contentTop + Math.max(0, (availableHeight - classroomHeight) / 2)
  const facingStudents = chart.viewDirection === 'facing-students'
  const gridTop = facingStudents ? classroomTop : classroomTop + platformHeight + platformGap
  const platformTop = facingStudents ? classroomTop + gridHeight + platformGap : classroomTop

  return {
    pageWidth,
    pageHeight,
    margin,
    titleTop,
    titleHeight,
    dividerTop,
    gridTop,
    gridLeft: (pageWidth - gridWidth) / 2,
    gridWidth,
    gridHeight,
    rowHeaderWidth,
    columnHeaderHeight,
    seatWidth,
    seatHeight,
    seatGap,
    aisleWidth,
    platformTop,
    platformWidth: Math.min(220 * scale, availableWidth * 0.48),
    platformHeight,
    specialSeatWidth: Math.min(66 * scale, availableWidth * 0.14),
    platformGap,
    fontScale: scale
  }
}
