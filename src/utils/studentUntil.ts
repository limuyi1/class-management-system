import type { TagCategoryType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import type { RecentScoreEntryType } from '@/types/Configuration'

/**
 * 创建系统内部使用的学生唯一标识。
 */
export function createStudentId(): string {
  return crypto.randomUUID()
}

/**
 * 校验完整学生名单是否都具有非空且不重复的 studentId。
 * 旧数据只要存在一条无效记录，整份名单就视为不可用。
 */
export function hasValidStudentIds(students: unknown): students is StudentDataType[] {
  if (!Array.isArray(students)) return false

  const studentIds = new Set<string>()
  for (const student of students) {
    if (!student || typeof student !== 'object' || Array.isArray(student)) return false

    const studentId = (student as Record<string, unknown>).studentId
    if (typeof studentId !== 'string' || !studentId.trim() || studentIds.has(studentId)) {
      return false
    }
    studentIds.add(studentId)
  }

  return true
}

/**
 * IndexedDB 中的旧名单不做隐式迁移；缺失或重复 studentId 时按无数据处理。
 */
export function normalizeStoredStudents(students: unknown): StudentDataType[] {
  return hasValidStudentIds(students) ? students : []
}

/**
 * 旧版最近成绩记录使用学生数组下标；新版只保留已经迁移为 studentId 的记录。
 */
export function normalizeRecentScoreEntries(
  value: unknown
): Record<string, RecentScoreEntryType[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).map(([scoreProp, entries]) => [
      scoreProp,
      Array.isArray(entries)
        ? entries.filter(
            (entry): entry is RecentScoreEntryType =>
              Boolean(
                entry &&
                  typeof entry === 'object' &&
                  typeof entry.studentId === 'string' &&
                  entry.studentId.trim()
              )
          )
        : []
    ])
  )
}

export function findStudentById(
  students: StudentDataType[],
  studentId: string | null | undefined
): StudentDataType | undefined {
  if (!studentId) return undefined
  return students.find((student) => student.studentId === studentId)
}

export interface StudentWithTags {
  tags?: Record<string, string[] | undefined>
}

export function extractStudentTags(
  item: StudentWithTags,
  tagCategoryList: TagCategoryType[]
): string[] {
  const allTags: string[] = []
  for (const cat of tagCategoryList) {
    const tagList = item.tags?.[cat.prop]
    if (tagList && tagList.length > 0) {
      allTags.push(...tagList)
    }
  }
  return Array.from(new Set(allTags.map((item) => item.trim()).filter(Boolean)))
}
