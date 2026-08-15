/**
 * 分数统计纯函数
 * 从 data-source store 中抽出，便于独立测试与复用。
 */

const computeRate = (scores: number[], predicate: (score: number) => boolean): number => {
  if (scores.length === 0) return 0
  return (scores.filter(predicate).length / scores.length) * 100
}

/** 平均分 */
export const computeAverage = (scores: number[]): number => {
  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/** 及格率（分数 >= 60） */
export const computePassRate = (scores: number[]): number => computeRate(scores, (s) => s >= 60)

/** 优秀率（分数 >= 80） */
export const computeExcellentRate = (scores: number[]): number =>
  computeRate(scores, (s) => s >= 80)

/** 最高分率（分数 >= 95） */
export const computeOptimumRate = (scores: number[]): number =>
  computeRate(scores, (s) => s >= 95)

/** 低分率（分数 <= 40） */
export const computeLowScoreRate = (scores: number[]): number =>
  computeRate(scores, (s) => s <= 40)

/**
 * 综合评分
 * 综合评分 = 平均分×0.4 + 及格率×0.3 + 优秀率×0.3 + 最高分率×0.05 - 低分率×0.05
 */
export const computeComprehensiveRatingRate = (scores: number[]): number => {
  if (scores.length === 0) return 0
  return (
    computeAverage(scores) * 0.4 +
    computePassRate(scores) * 0.3 +
    computeExcellentRate(scores) * 0.3 +
    computeOptimumRate(scores) * 0.05 -
    computeLowScoreRate(scores) * 0.05
  )
}
