/** 座位表 Excel 成果导出工具 */
import * as XLSX from 'xlsx'

import {
  SeatingFirstColumnSideEnum,
  SeatingSpecialSeatPositionEnum
} from '@/types/SeatingChart'
import { exportExcel } from '@/utils/xlsxUtil'
import {
  formatSeatingChartExportDate,
  sanitizeSeatingChartFileName
} from '@/utils/seating-chart/seatingChartExportUtil'

import type { SeatingChartType } from '@/types/SeatingChart'

type SeatingExcelCellType = string | null

/** 获取学生的职务简称文本。 */
function buildRoleText(chart: SeatingChartType, studentId: string | null): string {
  if (!studentId) return ''
  const definitions = new Map(chart.roleDefinitions.map((role) => [role.id, role]))
  const assignment = chart.roleAssignments.find((item) => item.studentId === studentId)
  return (assignment?.roleIds ?? [])
    .flatMap((roleId) => {
      const role = definitions.get(roleId)
      return role ? [role.shortLabel] : []
    })
    .join('、')
}

/** 将座位内容转换为“姓名 + 职务”文本。 */
function buildSeatText(
  chart: SeatingChartType,
  studentNames: Record<string, string>,
  studentId: string | null
): string {
  if (!studentId) return '空座位'
  const name = studentNames[studentId] || '未知学生'
  const roles = buildRoleText(chart, studentId)
  return roles ? `${name}\n${roles}` : name
}

/** 根据当前第一列方向生成展示列，并在对应位置插入过道。 */
function buildDisplayColumns(chart: SeatingChartType): Array<number | null> {
  const columns = Array.from({ length: chart.columns }, (_, index) => index)
  if (chart.firstColumnSide === SeatingFirstColumnSideEnum.Right) columns.reverse()
  return columns.flatMap((column) => {
    const aisleColumn =
      chart.firstColumnSide === SeatingFirstColumnSideEnum.Right ? column - 1 : column
    return chart.aisleAfterColumns.includes(aisleColumn) ? [column, null] : [column]
  })
}

/** 将座位表转换为保持视图方向、过道和特殊座位的二维 Excel 内容。 */
export function buildSeatingChartExcelRows(
  chart: SeatingChartType,
  studentNames: Record<string, string>
): SeatingExcelCellType[][] {
  const displayColumns = buildDisplayColumns(chart)
  const specialSeatMap = new Map(chart.specialSeats.map((seat) => [seat.position, seat]))
  const leftSeat = specialSeatMap.get(SeatingSpecialSeatPositionEnum.PlatformLeft)
  const rightSeat = specialSeatMap.get(SeatingSpecialSeatPositionEnum.PlatformRight)
  const rows: SeatingExcelCellType[][] = [
    [chart.name],
    [
      '讲台左侧特殊座位',
      leftSeat?.enabled ? buildSeatText(chart, studentNames, leftSeat.studentId) : '未启用',
      '讲台',
      '讲台右侧特殊座位',
      rightSeat?.enabled ? buildSeatText(chart, studentNames, rightSeat.studentId) : '未启用'
    ],
    [],
    ['排/列', ...displayColumns.map((column) => (column === null ? '过道' : `第 ${column + 1} 列`))]
  ]

  for (let row = 0; row < chart.rows; row += 1) {
    rows.push([
      `第 ${row + 1} 排`,
      ...displayColumns.map((column) => {
        if (column === null) return null
        const seat = chart.seats.find((item) => item.row === row && item.column === column)
        return buildSeatText(chart, studentNames, seat?.studentId ?? null)
      })
    ])
  }

  if (chart.notes.trim()) {
    rows.push([], ['备注说明'], ...chart.notes.split('\n').map((line) => [line]))
  }
  return rows
}

/** 生成并下载座位表 Excel 成果文件。 */
export function exportSeatingChartExcel(
  chart: SeatingChartType,
  studentNames: Record<string, string>
): void {
  const rows = buildSeatingChartExcelRows(chart, studentNames)
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 12 },
    ...buildDisplayColumns(chart).map((column) => ({ wch: column === null ? 7 : 18 }))
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '座位表')
  const fileName = `${sanitizeSeatingChartFileName(chart.name)}_${formatSeatingChartExportDate()}.xlsx`
  const result = exportExcel(undefined, undefined, fileName, workbook)
  if (!result.success) throw result.error || new Error('座位表 Excel 导出失败')
}
