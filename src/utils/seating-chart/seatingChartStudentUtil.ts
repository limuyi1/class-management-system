/**
 * 座位表学生数据工具
 * 将系统学生或 Excel 原始数据转换为座位表所需的最小名单结构
 */
import { NAME_PROP, STUDENT_ID_PROP } from '@/constants'

import type { SeatingChartType } from '@/types/SeatingChart'
import type { StudentDataType } from '@/types/StudentData'
import type { ExcelRowType } from '@/utils/xlsxUtil'
import type { StudentSourceStudentType } from '@/types/StudentSource'

/** 规范化姓名字符串：空值转空串并去除首尾空格 */
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
