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

/** 标签汇总查询未命中时的空结果 */
const EMPTY_TAG_SUMMARY: StudentInfoTagSummaryType = {
  visibleTags: [],
  hiddenCount: 0
}

/**
 * 为学生表格一次性生成标签展示数据，避免在每个单元格渲染期间重复遍历分类。
 *
 * @param students 学生数据列表
 * @param categories 标签分类配置
 * @param visibleLimit 直接展示的标签数量上限
 * @returns 学生 ID 到标签汇总的映射
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

/**
 * 将新学生插入指定一基序号；目标位置已有学生时，该学生及其后续学生顺延。
 * @param students 学生列表
 * @param student 待插入学生
 * @param sequence 目标序号（从 1 开始）
 */
export function insertStudentAtSequence(
  students: StudentDataType[],
  student: StudentDataType,
  sequence: number
): void {
  const targetIndex = Math.min(Math.max(Math.trunc(sequence) - 1, 0), students.length)
  students.splice(targetIndex, 0, student)
}

/**
 * 按一基序号移动学生；目标位置已有学生时，中间学生自动前移或后移。
 * @param students 学生列表
 * @param studentId 待移动学生 ID
 * @param sequence 目标序号（从 1 开始）
 * @returns 是否成功移动
 */
export function moveStudentToSequence(
  students: StudentDataType[],
  studentId: string,
  sequence: number
): boolean {
  const sourceIndex = students.findIndex((student) => student.studentId === studentId)
  if (sourceIndex === -1) return false
  const targetIndex = Math.min(Math.max(Math.trunc(sequence) - 1, 0), students.length - 1)
  if (sourceIndex === targetIndex) return true

  const [student] = students.splice(sourceIndex, 1)
  students.splice(targetIndex, 0, student)
  return true
}
