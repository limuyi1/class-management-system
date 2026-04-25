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
 * pinyin-pro 生成的字段名可能为空字符串，排名计算时必须保证键值稳定。
 */
export const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '未命名' : String(name)
}

/**
 * 将分数字段统一转换成数值，兼容表格中字符串数字的场景。
 * Excel 导出/导入场景下分数可能被解析为字符串，需要统一处理。
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

/**
 * 计算算术平均数。
 * 用于班级均分、学生历史均分等场景。
 */
export const averageOf = (scores: number[]): number =>
  scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0

/**
 * 计算样本标准差（总体标准差公式）。
 * σ = sqrt(Σ(xi - μ)² / n)
 * 用于衡量学生成绩的稳定性，标准差越大说明成绩波动越大。
 */
export const standardDeviationOf = (scores: number[]): number => {
  if (!scores.length) return 0
  const average = averageOf(scores)
  const variance = averageOf(scores.map((score) => (score - average) ** 2))

  return Math.sqrt(variance)
}

/**
 * 格式化分数显示，保留一位小数。
 * 用于折线图标签、卡片数值等展示场景。
 */
export const formatScore = (score: number): string => Number(score.toFixed(1)).toString()

/**
 * 格式化趋势文本，用箭头连接多个分数。
 * 例如：[85, 78, 82] => "85.0 → 78.0 → 82.0"
 */
export const formatTrendText = (scores: number[]): string => {
  if (!scores.length) return '--'

  return scores.map((score) => formatScore(score)).join(' → ')
}

/**
 * 格式化分差文本，返回绝对值字符串。
 * 用于展示上升/下降幅度时统一显示正数。
 */
export const getScoreDiffText = (value: number): string => Number(Math.abs(value).toFixed(1)).toString()

/**
 * 滑动窗口取值：返回数组末尾的 windowSize 个元素。
 * 用于获取学生"最近 N 次"成绩，取最近的时间窗口而非最早的。
 */
export const getRecentValues = <T>(values: T[], windowSize: number): T[] => {
  if (windowSize <= 0) return values
  return values.slice(-windowSize)
}

/**
 * 判断成绩序列是否严格单调递增。
 * 用于”进步明显”标签的判断条件之一。
 */
export const isStrictlyAscending = (scores: number[]): boolean => {
  if (scores.length < 2) return false

  return scores.every((score, index) => index === 0 || score > scores[index - 1])
}

/**
 * 判断成绩序列是否严格单调递减。
 * 用于”下滑关注”标签的判断条件之一。
 */
export const isStrictlyDescending = (scores: number[]): boolean => {
  if (scores.length < 2) return false

  return scores.every((score, index) => index === 0 || score < scores[index - 1])
}

/**
 * 为每个单元生成学生排名映射。
 * 按分数降序排列，相同分数排名相同（并列），下一名次跳过多占的名次。
 * 用于”稳定前列”标签判断学生是否长期处于班级前 N 名。
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

/**
 * 根据标签配置和分组配置创建标签对象。
 * 将配置中的元数据和分组信息合并为可直接使用的 DashboardStudentTagType。
 */
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

/**
 * 计算最近一次成绩与最早一次成绩的差值。
 * 正数表示上升，负数表示下降。
 * 用于判断整体趋势方向。
 */
export const getRecentChange = (scores: number[]): number => {
  if (scores.length < 2) return 0

  return scores[scores.length - 1] - scores[0]
}

/**
 * 判断波动方向：
 * - 若首尾差值 > 0 则为上行
 * - 若首尾差值 < 0 则为下行
 * - 若首尾差值 = 0，再看最新成绩是否高于均值：高于均值为上行，低于均值为下行
 * 用于波动生标签的细分展示（波动上行/波动下行）。
 */
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
