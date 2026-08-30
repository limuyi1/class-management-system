/**
 * 测试 scoreStatisticsUtil 模块。
 * 覆盖：平均分、及格率（≥60）、优秀率（≥80）、优良率（≥95）、
 * 低分率（≤40）以及加权综合评分率等统计指标的计算与空数组处理。
 */
import { describe, expect, it } from 'vitest'

import {
  computeAverage,
  computeComprehensiveRatingRate,
  computeExcellentRate,
  computeLowScoreRate,
  computeOptimumRate,
  computePassRate
} from '@/utils/scoreStatisticsUtil'

// 成绩统计工具函数测试组
describe('scoreStatisticsUtil', () => {
  // 平均分计算
  describe('computeAverage', () => {
    it('空数组返回 0', () => {
      expect(computeAverage([])).toBe(0)
    })

    it('计算平均值', () => {
      expect(computeAverage([0, 100])).toBe(50)
      expect(computeAverage([1, 2, 3, 4])).toBe(2.5)
    })
  })

  // 及格率计算（分数 >= 60）
  describe('computePassRate', () => {
    it('空数组返回 0', () => {
      expect(computePassRate([])).toBe(0)
    })

    it('统计分数 >= 60 的占比', () => {
      expect(computePassRate([59, 60, 61])).toBeCloseTo(66.67, 2)
      expect(computePassRate([60, 80, 100])).toBe(100)
    })
  })

  // 优秀率计算（分数 >= 80）
  describe('computeExcellentRate', () => {
    it('统计分数 >= 80 的占比', () => {
      expect(computeExcellentRate([79, 80, 81])).toBeCloseTo(66.67, 2)
    })
  })

  // 优良率计算（分数 >= 95）
  describe('computeOptimumRate', () => {
    it('统计分数 >= 95 的占比', () => {
      expect(computeOptimumRate([94, 95, 100])).toBeCloseTo(66.67, 2)
    })
  })

  // 低分率计算（分数 <= 40）
  describe('computeLowScoreRate', () => {
    it('统计分数 <= 40 的占比', () => {
      expect(computeLowScoreRate([40, 41, 50])).toBeCloseTo(33.33, 2)
    })
  })

  // 综合评分率计算（平均分、及格率、优秀率、最高分率与低分率加权）
  describe('computeComprehensiveRatingRate', () => {
    it('空数组返回 0', () => {
      expect(computeComprehensiveRatingRate([])).toBe(0)
    })

    it('按加权公式计算综合评分', () => {
      // 平均分 100×0.4 + 及格率 100×0.3 + 优秀率 100×0.3 + 最高分率 100×0.05 - 低分率 0×0.05 = 105
      expect(computeComprehensiveRatingRate([100])).toBe(105)
    })
  })
})
