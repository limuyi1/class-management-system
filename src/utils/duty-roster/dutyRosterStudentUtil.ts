import { NAME_PROP, STUDENT_ID_PROP } from '@/constants'

import type { DutyRosterType } from '@/types/DutyRoster'
import type { StudentDataType } from '@/types/StudentData'
import type { StudentSourceStudentType } from '@/types/StudentSource'
import type { ExcelRowType } from '@/utils/xlsxUtil'

/** 规范化姓名字符串：空值转空串并去除首尾空格 */
const normalizeName = (value: unknown): string => String(value ?? '').trim()

/** 将系统学生转换为值日表只需要的最小数据结构。 */
export function buildSystemDutyStudents(students: StudentDataType[]): StudentSourceStudentType[] {
  return students.map((student) => ({
    id: student[STUDENT_ID_PROP],
    name: normalizeName(student[NAME_PROP]) || '未命名学生'
  }))
}

/**
 * 按 Excel 原始数据顺序建立值日表名单。ID 使用数据行序号，允许名单中存在同名学生。
 */
export function buildExcelDutyStudents(
  rows: ExcelRowType[],
  nameColumn: string
): StudentSourceStudentType[] {
  return rows.flatMap((row, index) => {
    const name = normalizeName(row[nameColumn])
    return name ? [{ id: `excel:${index}`, name }] : []
  })
}

/** 根据值日表绑定的数据来源返回当前有效学生。 */
export function resolveDutyRosterStudents(
  roster: DutyRosterType | null,
  systemStudents: StudentDataType[]
): StudentSourceStudentType[] {
  if (!roster) return []
  if (roster.studentSource === 'excel') return roster.excelSource?.students ?? []
  return buildSystemDutyStudents(systemStudents)
}
