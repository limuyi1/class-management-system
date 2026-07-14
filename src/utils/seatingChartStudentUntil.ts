import { NAME_PROP, STUDENT_ID_PROP } from '@/types/Constants'

import type { SeatingChartType } from '@/types/SeatingChart'
import type { StudentDataType } from '@/types/StudentData'
import type { ExcelRowType } from '@/utils/xlsxUntil'
import type { StudentSourceStudentType } from '@/types/StudentSource'

const normalizeName = (value: unknown): string => String(value ?? '').trim()

/** 将系统学生转换为座位表只需要的最小数据结构。 */
export function buildSystemSeatingStudents(
  students: StudentDataType[]
): StudentSourceStudentType[] {
  return students.map((student) => ({
    id: student[STUDENT_ID_PROP],
    name: normalizeName(student[NAME_PROP]) || '未命名学生'
  }))
}

/**
 * 按 Excel 原始数据顺序建立座位表名单。ID 使用数据行序号，允许名单中存在同名学生。
 */
export function buildExcelSeatingStudents(
  rows: ExcelRowType[],
  nameColumn: string
): StudentSourceStudentType[] {
  return rows.flatMap((row, index) => {
    const name = normalizeName(row[nameColumn])
    return name ? [{ id: `excel:${index}`, name }] : []
  })
}

/** 根据座位表绑定的数据来源返回当前有效学生。 */
export function resolveSeatingChartStudents(
  chart: SeatingChartType | null,
  systemStudents: StudentDataType[]
): StudentSourceStudentType[] {
  if (!chart) return []
  if (chart.studentSource === 'excel') return chart.excelSource?.students ?? []
  return buildSystemSeatingStudents(systemStudents)
}
