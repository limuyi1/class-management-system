/** 单元统计与难度偏移计算。 */
import {
  averageOf,
  getNumericScore,
  getRecentValues,
  standardDeviationOf
} from '@/views/overview/services/dashboard/helpers'

import type {
  DashboardUnitDifficultyShiftType,
  OverviewDashboardConfigType
} from '@/types/OverviewDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import type { UnitMetricType } from '@/views/overview/services/dashboard/types'

/**
 * 生成单元维度统计，供概览图、教学提示和 KPI 共用。
 *
 * 输入：学生数据列表、配置的表头（单元列表）、全局配置
 * 处理：按单元分组，计算每个单元的均分、低分人数、标准差、分数段分布
 * 输出：UnitMetricType[]，每个单元的汇总统计数据
 *
 * 注意：只返回有有效成绩的单元（validCount > 0）
 *
 * @param students 学生数据列表
 * @param unitHeaders 单元表头配置
 * @param config 总览页配置
 * @returns 单元维度统计列表
 */
export const buildUnitMetrics = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  config: OverviewDashboardConfigType
): UnitMetricType[] => {
  const passLine = config.tagRules.passLine

  return unitHeaders
    .map((header) => {
      // 提取该单元所有有效分数，null 值（未录入）被过滤
      const scores = students
        .map((student) => getNumericScore(student, header.prop))
        .filter((score): score is number => score !== null)

      return {
        prop: header.prop,
        label: header.label,
        averageScore: Number(averageOf(scores).toFixed(2)),
        validCount: scores.length,
        scores,
        // 低于及格线的人数，用于判断该单元整体表现
        lowScoreCount: scores.filter((score) => score < passLine).length,
        standardDeviation: Number(standardDeviationOf(scores).toFixed(2)),
        // 分数段分布：90-100、80-89、70-79、60-69、60以下 各有多少人
        scoreBands: config.unitOverview.scoreBands.map((band) => ({
          ...band,
          count: scores.filter((score) => score >= band.min && score < band.max + 1).length
        }))
      }
    })
    .filter((item) => item.validCount > 0)
}

/**
 * 为每个单元计算难度偏移信息。
 *
 * 规则：
 * - 首个单元没有参照物，始终记为 normal，作为后续基线
 * - 有历史正常单元时，班均较近期正常基线明显上浮/下探：记为 easy/hard
 * - 没有历史正常基线时，才使用明显高/低的绝对边界：记为 easy/hard
 * - 变化不明显：记为 normal
 *
 * 这个映射一方面用于给对应单元分数做颜色提示，
 * 另一方面也为“最新单元是否需要做难度修正”提供基线。
 */
export const buildUnitDifficultyShiftMap = (
  unitMetrics: UnitMetricType[],
  config: OverviewDashboardConfigType
): Map<string, { shift: number; difficultyShift: DashboardUnitDifficultyShiftType }> => {
  const result = new Map<
    string,
    { shift: number; difficultyShift: DashboardUnitDifficultyShiftType }
  >()
  const normalUnitAverages: number[] = []
  const threshold = config.tagRules.latestUnitDifficultyShiftThreshold
  const baselineWindow = config.tagRules.unitDifficultyBaselineWindow
  const easyAverageScore = config.tagRules.easyUnitAverageScore
  const hardAverageScore = config.tagRules.hardUnitAverageScore

  unitMetrics.forEach((metric, index) => {
    if (index === 0) {
      result.set(metric.prop, {
        shift: 0,
        difficultyShift: 'normal'
      })
      normalUnitAverages.push(metric.averageScore)
      return
    }

    const recentNormalAverages = getRecentValues(normalUnitAverages, baselineWindow)
    const hasBaseline = recentNormalAverages.length > 0
    const baselineAverage = hasBaseline ? averageOf(recentNormalAverages) : null
    const absoluteDifficultyShift: DashboardUnitDifficultyShiftType =
      metric.averageScore >= easyAverageScore
        ? 'easy'
        : metric.averageScore <= hardAverageScore
          ? 'hard'
          : 'normal'
    const absoluteShift =
      absoluteDifficultyShift === 'easy'
        ? metric.averageScore - easyAverageScore
        : absoluteDifficultyShift === 'hard'
          ? metric.averageScore - hardAverageScore
          : 0
    const relativeShift =
      baselineAverage === null ? 0 : Number((metric.averageScore - baselineAverage).toFixed(2))
    const relativeDifficultyShift: DashboardUnitDifficultyShiftType =
      Math.abs(relativeShift) >= threshold ? (relativeShift > 0 ? 'easy' : 'hard') : 'normal'
    const fallbackAbsoluteDifficultyShift: DashboardUnitDifficultyShiftType =
      hasBaseline && absoluteDifficultyShift === 'easy' ? 'normal' : absoluteDifficultyShift
    const difficultyShift: DashboardUnitDifficultyShiftType =
      relativeDifficultyShift !== 'normal'
        ? relativeDifficultyShift
        : fallbackAbsoluteDifficultyShift
    const relativeEffectiveShift =
      relativeDifficultyShift === 'easy'
        ? relativeShift - threshold
        : relativeDifficultyShift === 'hard'
          ? relativeShift
          : 0
    const effectiveShift =
      relativeDifficultyShift !== 'normal'
        ? relativeEffectiveShift
        : difficultyShift === 'normal'
          ? 0
          : absoluteShift

    result.set(metric.prop, {
      shift: Number(effectiveShift.toFixed(2)),
      difficultyShift
    })

    if (difficultyShift === 'normal') {
      normalUnitAverages.push(metric.averageScore)
    }
  })

  return result
}
