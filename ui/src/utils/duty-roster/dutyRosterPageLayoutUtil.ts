/**
 * 值日表页面布局工具
 * 估算值日表内容在纸张中的可读比例，供预览适配使用
 */
import { PagesEnum } from '@/types/Common'
import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { getPageSize } from '@/utils/pageSizeInPixelUtil'

/** 值日表页面布局计算结果 */
export interface DutyRosterPageLayoutType {
  pageWidth: number
  pageHeight: number
  margin: number
  fitScale: number
  fontScale: number
  positionCount: number
  rowCount: number
}

// 以下为值日表各组成部分的基准尺寸（pt），用于估算自然内容宽高后计算适配比例。
const BASE_PERIOD_WIDTH = 64
const BASE_POSITION_WIDTH = 94
const BASE_TABLE_HEADER_HEIGHT = 70
const BASE_ROW_HEIGHT = 62
const BASE_TITLE_HEIGHT = 58
const BASE_NOTES_HEADING_HEIGHT = 28
const BASE_NOTE_LINE_HEIGHT = 17
const BASE_CONTENT_GAP = 20

/**
 * 估算值日表在横向纸张中的可读比例，实际预览仍按 DOM 自然尺寸精确适配。
 * @param roster - 值日表数据
 * @param pageType - 纸张类型
 * @param scaleRatio - 字体缩放比例
 * @param showTitle - 是否显示标题
 * @param showNotes - 是否显示备注
 * @returns 页面布局计算结果
 */
export function buildDutyRosterPageLayout(
  roster: DutyRosterType,
  pageType: PagesEnum,
  scaleRatio = 1,
  showTitle = true,
  showNotes = true
): DutyRosterPageLayoutType {
  const { width: pageWidth, height: pageHeight } = getPageSize(pageType, 'landscape')
  const margin = pageType === PagesEnum.A3 || pageType === PagesEnum.B3 ? 24 : 18
  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - margin * 2
  const positionCount = roster.sections.reduce(
    (count, section) => count + section.positions.length,
    0
  )
  const rowCount =
    roster.mode === DutyRosterModeEnum.Daily ? 5 : Math.max(1, roster.weeklyRows?.length || 0)
  const naturalTableWidth =
    Math.max(1, positionCount) * BASE_POSITION_WIDTH +
    (roster.mode === DutyRosterModeEnum.Daily ? BASE_PERIOD_WIDTH : 0)
  const noteCharactersPerLine = Math.max(24, Math.floor(naturalTableWidth / 10))
  const noteLineCount = roster.notes
    .split('\n')
    .filter((line) => line.trim())
    .reduce(
      (count, line) =>
        count + Math.max(1, Math.ceil(Array.from(line.trim()).length / noteCharactersPerLine)),
      0
    )
  const naturalTableHeight = BASE_TABLE_HEADER_HEIGHT + rowCount * BASE_ROW_HEIGHT
  const naturalTitleHeight = showTitle ? BASE_TITLE_HEIGHT + BASE_CONTENT_GAP : 0
  const naturalNotesHeight =
    showNotes && noteLineCount
      ? BASE_NOTES_HEADING_HEIGHT + noteLineCount * BASE_NOTE_LINE_HEIGHT + BASE_CONTENT_GAP
      : 0
  const naturalWidth = Math.max(520, naturalTableWidth)
  const naturalHeight = naturalTitleHeight + naturalTableHeight + naturalNotesHeight
  const fitScale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight)
  const occupancy = Math.min(1.5, Math.max(0.7, scaleRatio))

  return {
    pageWidth,
    pageHeight,
    margin,
    fitScale,
    fontScale: fitScale * occupancy,
    positionCount,
    rowCount
  }
}
