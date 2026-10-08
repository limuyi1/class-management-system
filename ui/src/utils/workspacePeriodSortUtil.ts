import type { WorkspacePeriodType } from '@/types/Workspace'

/** 从学期名称中提取学年和上下学期，兼容空格及全角数字。 */
function termOrder(name: string): [number, number] | null {
  const normalized = name.normalize('NFKC').replace(/\s+/g, '')
  const year = normalized.match(/\d{4}/)
  if (!year) return null
  const semester = /下学期|第[二2]学期/.test(normalized)
    ? 2
    : /上学期|第[一1]学期/.test(normalized)
      ? 1
      : 0
  return [Number(year[0]), semester]
}

/**
 * 按学年倒序排列学期，同一学年下学期在上学期前，不改变原目录。
 * 自定义名称排在可识别学年之后，按创建时间倒序；同名学期也以创建时间区分。
 */
export function sortWorkspacePeriods(
  periods: readonly WorkspacePeriodType[]
): WorkspacePeriodType[] {
  return [...periods].sort((left, right) => {
    const leftOrder = termOrder(left.termName)
    const rightOrder = termOrder(right.termName)
    if (leftOrder && rightOrder) {
      const difference = rightOrder[0] - leftOrder[0] || rightOrder[1] - leftOrder[1]
      if (difference) return difference
    } else if (leftOrder || rightOrder) {
      return leftOrder ? -1 : 1
    }
    const leftCreated = Date.parse(left.createdAt) || 0
    const rightCreated = Date.parse(right.createdAt) || 0
    return (
      rightCreated - leftCreated ||
      right.termName.localeCompare(left.termName, 'zh-CN', { numeric: true })
    )
  })
}
