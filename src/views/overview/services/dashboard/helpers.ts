import { NAME_PROP } from '@/types/Constants'
import type {
  DashboardStudentTagType,
  DashboardTagKeyType,
  DashboardVolatilityDirectionType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

/**
 * 读取学生姓名字段，并兜底成稳定文本，避免下游排序和映射出现空值。
 */
export const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '未命名' : String(name)
}

/**
 * 将分数字段统一转换成数值，兼容表格中字符串数字的场景。
 */
export const getNumericScore = (student: StudentDataType, prop: string): number | null => {
  const value = student[prop]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const averageOf = (scores: number[]): number =>
  scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0

export const standardDeviationOf = (scores: number[]): number => {
  if (!scores.length) return 0
  const average = averageOf(scores)
  const variance = averageOf(scores.map((score) => (score - average) ** 2))

  return Math.sqrt(variance)
}

export const formatScore = (score: number): string => Number(score.toFixed(1)).toString()

export const formatTrendText = (scores: number[]): string => {
  if (!scores.length) return '--'

  return scores.map((score) => formatScore(score)).join(' → ')
}

export const getScoreDiffText = (value: number): string => Number(Math.abs(value).toFixed(1)).toString()

export const getRecentValues = <T>(values: T[], windowSize: number): T[] => {
  if (windowSize <= 0) return values
  return values.slice(-windowSize)
}

export const isStrictlyAscending = (scores: number[]): boolean => {
  if (scores.length < 2) return false

  return scores.every((score, index) => index === 0 || score > scores[index - 1])
}

export const isStrictlyDescending = (scores: number[]): boolean => {
  if (scores.length < 2) return false

  return scores.every((score, index) => index === 0 || score < scores[index - 1])
}

/**
 * 为每个单元生成学生排名映射，供标签规则判断“稳定前列”使用。
 */
export const buildRankMapByUnit = (students: StudentDataType[], unitHeaders: SettingType[]) => {
  return unitHeaders.map((header) => {
    const rankMap = new Map<string, number>()
    const rankedStudents = students
      .map((student) => ({
        name: getStudentName(student),
        score: getNumericScore(student, header.prop)
      }))
      .filter((item): item is { name: string; score: number } => item.score !== null)
      .sort((a, b) => b.score - a.score)

    rankedStudents.forEach((item, index) => {
      rankMap.set(item.name, index + 1)
    })

    return {
      prop: header.prop,
      rankMap
    }
  })
}

export const createTag = (
  key: DashboardTagKeyType,
  config: HomeDashboardConfigType
): DashboardStudentTagType => {
  const tagConfig = config.tagRules.tags[key]
  const groupConfig = config.tagRules.tagGroups[tagConfig.group]

  return {
    key,
    label: tagConfig.label,
    priority: tagConfig.priority,
    group: tagConfig.group,
    tone: groupConfig.tone,
    description: tagConfig.description
  }
}

export const getRecentChange = (scores: number[]): number => {
  if (scores.length < 2) return 0

  return scores[scores.length - 1] - scores[0]
}

export const getVolatilityDirection = (scores: number[]): DashboardVolatilityDirectionType | null => {
  if (!scores.length) return null

  const recentChange = getRecentChange(scores)
  if (recentChange > 0) return 'up'
  if (recentChange < 0) return 'down'

  const average = averageOf(scores)
  const latestScore = scores[scores.length - 1]

  if (latestScore > average) return 'up'
  if (latestScore < average) return 'down'

  return null
}
