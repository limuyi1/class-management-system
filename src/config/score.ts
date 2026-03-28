/**
 * 分数区间配置
 * 用于成绩统计、颜色显示等功能
 */
export interface ScoreRange {
  /** 区间显示名称，如 "90-100分" */
  label: string
  /** 区间最小分数（包含）*/
  min: number
  /** 区间最大分数（包含）*/
  max: number
  /** 区间对应颜色（十六进制）*/
  color: string
}

/**
 * 完整分数区间配置（0-100分）
 * 包含10个区间，每个区间对应不同的颜色
 */
export const scoreRanges: ScoreRange[] = [
  { label: '90-100分', min: 90, max: 100, color: '#22c55e' },
  { label: '80-89分', min: 80, max: 89, color: '#3b82f6' },
  { label: '70-79分', min: 70, max: 79, color: '#eab308' },
  { label: '60-69分', min: 60, max: 69, color: '#f97316' },
  { label: '50-59分', min: 50, max: 59, color: '#ef4444' },
  { label: '40-49分', min: 40, max: 49, color: '#dc2626' },
  { label: '30-39分', min: 30, max: 39, color: '#b91c1c' },
  { label: '20-29分', min: 20, max: 29, color: '#991b1b' },
  { label: '10-19分', min: 10, max: 19, color: '#7f1d1d' },
  { label: '0-9分', min: 0, max: 9, color: '#450a0a' }
]

/**
 * 及格分数区间（60分及以上）
 * 用于统计及格人数、及格率等
 */
export const passingScoreRanges: ScoreRange[] = scoreRanges.slice(0, 4)

/**
 * 低分分数区间（60分以下）
 * 用于统计低分人数、预警等
 */
export const lowScoreRanges: ScoreRange[] = scoreRanges.slice(4)

/**
 * 根据分数获取对应的区间颜色
 * @param score - 学生分数
 * @returns 对应的十六进制颜色值，如未找到则返回 undefined
 *
 * @example
 * const color = getScoreColor(85) // 返回 '#3b82f6'
 */
export const getScoreColor = (score: number): string | undefined => {
  const range = scoreRanges.find((r) => score >= r.min && score <= r.max)
  return range?.color
}
