import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'

/** 标签循环取用的主题色变量 */
const TAG_COLOR_VARS = [
  'var(--theme-tag-1)',
  'var(--theme-tag-2)',
  'var(--theme-tag-3)',
  'var(--theme-tag-4)',
  'var(--theme-tag-5)',
  'var(--theme-tag-6)',
  'var(--theme-tag-7)',
  'var(--theme-tag-8)'
]

/** 学生信息表格中展示的单个标签 */
export interface StudentInfoDisplayTagType {
  key: string
  label: string
  color: string
}

/** 学生标签汇总：可见标签与隐藏数量 */
export interface StudentInfoTagSummaryType {
  visibleTags: StudentInfoDisplayTagType[]
  hiddenCount: number
}

const EMPTY_TAG_SUMMARY: StudentInfoTagSummaryType = {
  visibleTags: [],
  hiddenCount: 0
}

/**
 * 为学生表格一次性生成标签展示数据，避免在每个单元格渲染期间重复遍历分类。
 */
export function buildStudentInfoTagSummaryMap(
  students: StudentDataType[],
  categories: TagCategoryType[],
  visibleLimit = 3
): Map<string, StudentInfoTagSummaryType> {
  const categoryDisplayMap = new Map(
    categories.map((category, index) => [
      category.prop,
      {
        color: TAG_COLOR_VARS[index % TAG_COLOR_VARS.length]
      }
    ])
  )

  return new Map(
    students.map((student) => {
      const displayTags: StudentInfoDisplayTagType[] = []

      Object.entries(student.tags || {}).forEach(([categoryProp, tags]) => {
        if (!Array.isArray(tags)) return

        const category = categoryDisplayMap.get(categoryProp)
        tags.forEach((tag) => {
          displayTags.push({
            key: `${categoryProp}:${tag}`,
            label: tag,
            color: category?.color || TAG_COLOR_VARS[0]
          })
        })
      })

      return [
        student.studentId,
        {
          visibleTags: displayTags.slice(0, visibleLimit),
          hiddenCount: Math.max(displayTags.length - visibleLimit, 0)
        }
      ]
    })
  )
}

/**
 * 从汇总 Map 中读取指定学生的标签汇总，未命中时返回空汇总。
 *
 * @param summaryMap 标签汇总 Map
 * @param studentId 学生 ID
 * @returns 标签汇总
 */
export function getStudentInfoTagSummary(
  summaryMap: Map<string, StudentInfoTagSummaryType>,
  studentId: string
): StudentInfoTagSummaryType {
  return summaryMap.get(studentId) || EMPTY_TAG_SUMMARY
}
