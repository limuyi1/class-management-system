import { NAME_PROP, STUDENT_ID_PROP } from '@/types/Constants'

import type { DutyRosterType } from '@/types/DutyRoster'
import type { StudentDataType } from '@/types/StudentData'
import type { StudentSourceStudentType } from '@/types/StudentSource'
import type { ExcelRowType } from '@/utils/xlsxUntil'

const normalizeName = (value: unknown): string => String(value ?? '').trim()

export function buildSystemDutyStudents(students: StudentDataType[]): StudentSourceStudentType[] {
  return students.map((student) => ({
    id: student[STUDENT_ID_PROP],
    name: normalizeName(student[NAME_PROP]) || '未命名学生'
  }))
}

export function buildExcelDutyStudents(
  rows: ExcelRowType[],
  nameColumn: string
): StudentSourceStudentType[] {
  return rows.flatMap((row, index) => {
    const name = normalizeName(row[nameColumn])
    return name ? [{ id: `excel:${index}`, name }] : []
  })
}

export function resolveDutyRosterStudents(
  roster: DutyRosterType | null,
  systemStudents: StudentDataType[]
): StudentSourceStudentType[] {
  if (!roster) return []
  if (roster.studentSource === 'excel') return roster.excelSource?.students ?? []
  return buildSystemDutyStudents(systemStudents)
}
