import { PagesEnum } from '@/types/Common'

import type { SeatingChartType } from '@/types/SeatingChart'

/** 座位表页面尺寸（单位：点 pt） */
export interface SeatingChartPageSizeType {
  width: number
  height: number
}

/** 座位表页面布局计算结果：纸张、边距与缩放比例 */
export interface SeatingChartPageLayoutType {
  pageWidth: number
  pageHeight: number
  margin: number
  fitScale: number
  fontScale: number
}

/** 页面方向：纵向或横向 */
export type SeatingChartPageOrientationType = 'portrait' | 'landscape'

/** 各纸张在 PDF 坐标系下的纵向尺寸（单位：点 pt） */
const PAGE_SIZE: Record<PagesEnum, SeatingChartPageSizeType> = {
  [PagesEnum.A4]: { width: 595.28, height: 841.89 },
  [PagesEnum.A3]: { width: 841.89, height: 1190.55 },
  [PagesEnum.B4]: { width: 708.66, height: 1000.63 },
  [PagesEnum.B3]: { width: 1000.63, height: 1417.32 }
}

// 以下为座位表各组成部分的基准尺寸（pt），用于估算自然内容宽高后计算适配比例。
const BASE_SEAT_WIDTH = 62
const BASE_SEAT_HEIGHT = 36
const BASE_SEAT_GAP = 5
const BASE_AISLE_WIDTH = 18
const BASE_ROW_HEADER_WIDTH = 22
const BASE_COLUMN_HEADER_HEIGHT = 20
const BASE_PLATFORM_WIDTH = 220
const BASE_SPECIAL_SEAT_WIDTH = 66
const BASE_SPECIAL_SEAT_GAP = 8
const BASE_PLATFORM_HEIGHT = 38
const BASE_PLATFORM_GAP = 18
const BASE_TITLE_HEIGHT = 24
const BASE_TITLE_DIVIDER_GAP = 8
const BASE_DIVIDER_CLASSROOM_GAP = 14
const BASE_FOOTER_GAP = 12
const BASE_FOOTER_HEIGHT = 10

/**
 * 获取指定纸张与方向的页面尺寸。
 * @param pageType - 纸张类型
 * @param orientation - 页面方向
 * @returns 宽高尺寸（横向时宽高互换）
 */
export function getSeatingChartPageSize(
  pageType: PagesEnum,
  orientation: SeatingChartPageOrientationType
): SeatingChartPageSizeType {
  const portrait = PAGE_SIZE[pageType]
  return orientation === 'landscape'
    ? { width: portrait.height, height: portrait.width }
    : { ...portrait }
}

/**
 * 计算座位表内容在纸张内的适配比例，仅用于预览尺寸和方向推荐。
 */
export function buildSeatingChartPageLayout(
  chart: SeatingChartType,
  pageType: PagesEnum,
  orientation: SeatingChartPageOrientationType = 'landscape',
  scaleRatio = 1,
  showTitle = true
): SeatingChartPageLayoutType {
  const { width: pageWidth, height: pageHeight } = getSeatingChartPageSize(pageType, orientation)
  const margin = pageType === PagesEnum.A3 || pageType === PagesEnum.B3 ? 24 : 18
  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - margin * 2
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
  const enabledSpecialSeatCount = chart.specialSeats.filter((seat) => seat.enabled).length
  const naturalPlatformWidth =
    BASE_PLATFORM_WIDTH +
    enabledSpecialSeatCount * (BASE_SPECIAL_SEAT_WIDTH + BASE_SPECIAL_SEAT_GAP)
  const naturalContentWidth = Math.max(naturalGridWidth, naturalPlatformWidth)
  const naturalHeaderHeight = showTitle
    ? BASE_TITLE_HEIGHT + BASE_TITLE_DIVIDER_GAP + BASE_DIVIDER_CLASSROOM_GAP
    : 0
  const naturalContentHeight =
    naturalHeaderHeight +
    naturalGridHeight +
    BASE_PLATFORM_GAP +
    BASE_PLATFORM_HEIGHT +
    BASE_FOOTER_GAP +
    BASE_FOOTER_HEIGHT
  const fitScale = Math.min(
    availableWidth / naturalContentWidth,
    availableHeight / naturalContentHeight
  )
  const occupancy = Math.min(1.5, Math.max(0.1, scaleRatio))

  return {
    pageWidth,
    pageHeight,
    margin,
    fitScale,
    fontScale: fitScale * occupancy
  }
}

/**
 * 选择更适配座位表的页面方向：比较两种方向下的适配比例，取较大者。
 * @param chart - 座位表
 * @param pageType - 纸张类型
 * @param showTitle - 是否显示标题
 * @returns 推荐的页面方向
 */
export function resolveSeatingChartPageOrientation(
  chart: SeatingChartType,
  pageType: PagesEnum,
  showTitle = true
): SeatingChartPageOrientationType {
  const portrait = buildSeatingChartPageLayout(chart, pageType, 'portrait', 1, showTitle)
  const landscape = buildSeatingChartPageLayout(chart, pageType, 'landscape', 1, showTitle)
  return portrait.fitScale >= landscape.fitScale ? 'portrait' : 'landscape'
}
