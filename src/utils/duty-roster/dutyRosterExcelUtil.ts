/** 值日表 Excel 成果导出工具 */
import * as XLSX from 'xlsx'

import { DutyRosterModeEnum } from '@/types/DutyRoster'
import { exportExcel } from '@/utils/xlsxUtil'
import {
  DUTY_PERIOD_LABELS,
  getDutyPeriods
} from '@/utils/duty-roster/dutyRosterUtil'
import {
  formatDutyRosterExportDate,
  sanitizeDutyRosterFileName
} from '@/utils/duty-roster/dutyRosterExportUtil'

import type { DutyRosterType } from '@/types/DutyRoster'

type DutyExcelCellType = string | null

/** 将岗位内学生转换为可读文本，并标记所属区域的值日组长。 */
function buildAssignmentText(
  roster: DutyRosterType,
  studentNames: Record<string, string>,
  period: ReturnType<typeof getDutyPeriods>[number],
  rowId: string | undefined,
  sectionId: string,
  positionId: string
): string {
  const assignment = roster.assignments.find(
    (item) =>
      item.period === period && item.rowId === rowId && item.positionId === positionId
  )
  const leaderId = roster.leaders.find(
    (item) => item.period === period && item.rowId === rowId && item.sectionId === sectionId
  )?.studentId

  return (assignment?.studentIds ?? [])
    .map((studentId) => {
      const name = studentNames[studentId] || '未知学生'
      return studentId === leaderId ? `${name}（组长）` : name
    })
    .join('、')
}

/** 将值日表转换为二维 Excel 内容，供导出和测试复用。 */
export function buildDutyRosterExcelRows(
  roster: DutyRosterType,
  studentNames: Record<string, string>
): DutyExcelCellType[][] {
  const sections = [...roster.sections].sort((a, b) => a.sortOrder - b.sortOrder)
  const positions = sections.flatMap((section) =>
    [...section.positions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((position) => ({ section, position }))
  )
  const rows: DutyExcelCellType[][] = [
    [roster.name],
    ['安排方式', roster.mode === DutyRosterModeEnum.Daily ? '每组一天' : '每组一周'],
    [],
    ['值日周期', ...positions.map(({ section }) => section.name)],
    ['', ...positions.map(({ position }) => position.name)]
  ]

  if (roster.mode === DutyRosterModeEnum.Daily) {
    getDutyPeriods(roster.mode).forEach((period) => {
      rows.push([
        DUTY_PERIOD_LABELS[period],
        ...positions.map(({ section, position }) =>
          buildAssignmentText(
            roster,
            studentNames,
            period,
            undefined,
            section.id,
            position.id
          )
        )
      ])
    })
  } else {
    const period = getDutyPeriods(roster.mode)[0]
    ;[...roster.weeklyRows]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((weeklyRow, index) => {
        rows.push([
          `第 ${index + 1} 组`,
          ...positions.map(({ section, position }) =>
            buildAssignmentText(
              roster,
              studentNames,
              period,
              weeklyRow.id,
              section.id,
              position.id
            )
          )
        ])
      })
  }

  if (roster.notes.trim()) {
    rows.push([], ['备注说明'], ...roster.notes.split('\n').map((line) => [line]))
  }
  return rows
}

/** 生成并下载值日表 Excel 成果文件。 */
export function exportDutyRosterExcel(
  roster: DutyRosterType,
  studentNames: Record<string, string>
): void {
  const rows = buildDutyRosterExcelRows(roster, studentNames)
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!cols'] = [{ wch: 14 }, ...Array(Math.max(0, rows[3].length - 1)).fill({ wch: 20 })]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '值日表')
  const fileName = `${sanitizeDutyRosterFileName(roster.name)}_${formatDutyRosterExportDate()}.xlsx`
  const result = exportExcel(undefined, undefined, fileName, workbook)
  if (!result.success) throw result.error || new Error('值日表 Excel 导出失败')
}
