/**
 * 分数统计纯函数
 * 从 data-source store 中抽出，便于独立测试与复用。
 */

/**
 * 计算满足条件的分数占比（百分比）。
 * @param scores - 分数数组
 * @param predicate - 判断分数是否满足条件的谓词
 * @returns 满足条件的分数占比（0-100），空数组返回 0
 */
const computeRate = (scores: number[], predicate: (score: number) => boolean): number => {
  if (scores.length === 0) return 0
  return (scores.filter(predicate).length / scores.length) * 100
}

/**
 * 计算平均分。
 * @param scores - 分数数组
 * @returns 平均分，空数组返回 0
 */
export const computeAverage = (scores: number[]): number => {
  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/**
 * 计算及格率（分数 >= 60）。
 * @param scores - 分数数组
 * @returns 及格率百分比
 */
export const computePassRate = (scores: number[]): number => computeRate(scores, (s) => s >= 60)

/**
 * 计算优秀率（分数 >= 80）。
 * @param scores - 分数数组
 * @returns 优秀率百分比
 */
export const computeExcellentRate = (scores: number[]): number =>
  computeRate(scores, (s) => s >= 80)

/**
 * 计算最高分率（分数 >= 95）。
 * @param scores - 分数数组
 * @returns 最高分率百分比
 */
export const computeOptimumRate = (scores: number[]): number =>
  computeRate(scores, (s) => s >= 95)

/**
 * 计算低分率（分数 <= 40）。
 * @param scores - 分数数组
 * @returns 低分率百分比
 */
export const computeLowScoreRate = (scores: number[]): number =>
  computeRate(scores, (s) => s <= 40)

/**
 * 计算综合评分。
 * 综合评分 = 平均分×0.4 + 及格率×0.3 + 优秀率×0.3 + 最高分率×0.05 - 低分率×0.05
 * @param scores - 分数数组
 * @returns 综合评分，空数组返回 0
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
