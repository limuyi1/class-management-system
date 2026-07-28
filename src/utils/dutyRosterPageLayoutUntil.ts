import { PagesEnum } from '@/types/Common'
import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { getPageSize } from '@/utils/pageSizeInPixelUntil'

export interface DutyRosterPageLayoutType {
  pageWidth: number
  pageHeight: number
  margin: number
  fitScale: number
  fontScale: number
  positionCount: number
  rowCount: number
}

const BASE_PERIOD_WIDTH = 64
const BASE_POSITION_WIDTH = 94
const BASE_TABLE_HEADER_HEIGHT = 70
const BASE_ROW_HEIGHT = 62
const BASE_STUDENT_LINE_HEIGHT = 22
const BASE_TITLE_HEIGHT = 58
const BASE_NOTES_HEADING_HEIGHT = 28
const BASE_NOTE_LINE_HEIGHT = 17
const BASE_CONTENT_GAP = 20

/**
 * 估算值日表在横向纸张中的可读比例，实际预览仍按 DOM 自然尺寸精确适配。
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
  const maxStudentCount = Math.max(
    1,
    ...roster.assignments.map((assignment) => assignment.studentIds.length)
  )
  const noteLineCount = roster.notes.split('\n').filter((line) => line.trim()).length
  const naturalTableWidth =
    Math.max(1, positionCount) * BASE_POSITION_WIDTH +
    (roster.mode === DutyRosterModeEnum.Daily ? BASE_PERIOD_WIDTH : 0)
  const naturalRowHeight = Math.max(
    BASE_ROW_HEIGHT,
    maxStudentCount * BASE_STUDENT_LINE_HEIGHT + 18
  )
  const naturalTableHeight = BASE_TABLE_HEADER_HEIGHT + rowCount * naturalRowHeight
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
