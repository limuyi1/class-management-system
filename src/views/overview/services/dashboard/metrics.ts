import type { HomeDashboardConfigType } from '@/types/HomeDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

import {
  averageOf,
  buildRankMapByUnit,
  createTag,
  getNumericScore,
  getRecentValues,
  getStudentName,
  getVolatilityDirection,
  isStrictlyAscending,
  isStrictlyDescending,
  standardDeviationOf
} from '@/views/overview/services/dashboard/helpers'
import type { StudentMetricType, StudentPointType, UnitMetricType } from '@/views/overview/services/dashboard/types'

/**
 * 生成单元维度统计，供概览图、教学提示和 KPI 共用。
 */
export const buildUnitMetrics = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  config: HomeDashboardConfigType
): UnitMetricType[] => {
  const passLine = config.tagRules.passLine

  return unitHeaders
    .map((header) => {
      const scores = students
        .map((student) => getNumericScore(student, header.prop))
        .filter((score): score is number => score !== null)

      return {
        prop: header.prop,
        label: header.label,
        averageScore: Number(averageOf(scores).toFixed(2)),
        validCount: scores.length,
        scores,
        lowScoreCount: scores.filter((score) => score < passLine).length,
        standardDeviation: Number(standardDeviationOf(scores).toFixed(2)),
        scoreBands: config.unitOverview.scoreBands.map((band) => ({
          ...band,
          count: scores.filter((score) => score >= band.min && score <= band.max).length
        }))
      }
    })
    .filter((item) => item.validCount > 0)
}

/**
 * 生成学生维度画像，后续所有标签、推荐和趋势分析都基于这层中间结果。
 */
export const buildStudentMetrics = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  config: HomeDashboardConfigType
): StudentMetricType[] => {
  const rankMapByUnit = buildRankMapByUnit(students, unitHeaders)
  const passLine = config.tagRules.passLine
  const middleScoreMin = config.tagRules.middleScoreMin
  const middleScoreMax = config.tagRules.middleScoreMax

  return students
    .map((student) => {
      const name = getStudentName(student)
      const points = unitHeaders
        .map((header) => {
          const score = getNumericScore(student, header.prop)
          if (score === null) return null

          return {
            prop: header.prop,
            label: header.label,
            score,
            rank: rankMapByUnit.find((item) => item.prop === header.prop)?.rankMap.get(name) || null
          } satisfies StudentPointType
        })
        .filter((item): item is StudentPointType => item !== null)

      if (!points.length) return null

      const scores = points.map((point) => point.score)
      const latestScore = scores.length ? scores[scores.length - 1] : null
      const previousScore = scores.length >= 2 ? scores[scores.length - 2] : null
      const historyScores = scores.slice(0, -1)
      const tagConfigs = config.tagRules.tags
      const recentScores = getRecentValues(scores, 4)
      const recentThreeScores = getRecentValues(scores, 3)
      const recentFourScores = getRecentValues(scores, tagConfigs.volatility.recentWindow)
      const latestDelta =
        latestScore !== null && historyScores.length
          ? Number((latestScore - averageOf(historyScores)).toFixed(2))
          : 0
      const latestDrop =
        latestScore !== null && previousScore !== null && latestScore < previousScore
          ? Number((previousScore - latestScore).toFixed(2))
          : 0
      const recentRanks = getRecentValues(
        points
          .map((point) => point.rank)
          .filter((rank): rank is number => typeof rank === 'number'),
        config.tagRules.tags.stableTop.recentWindow
      )
      const stableTopRecentCount = recentRanks.filter(
        (rank) => rank <= (config.tagRules.tags.stableTop.topRankLimit || 5)
      ).length

      const matchedTags = []
      const latestRecent3 = recentThreeScores
      const latestRecent4 = recentFourScores
      const latestRecent3Average = averageOf(latestRecent3)
      const latestTrendDelta =
        latestRecent3.length >= 2 ? latestRecent3[latestRecent3.length - 1] - latestRecent3[0] : 0
      const recentStdDev = standardDeviationOf(latestRecent4)
      const volatilityDirection = getVolatilityDirection(latestRecent3)
      const recentMiddleScore =
        latestScore !== null && latestScore >= middleScoreMin && latestScore <= middleScoreMax
      const recentMiddleHitCount = latestRecent3.filter(
        (score) => score >= middleScoreMin && score <= middleScoreMax
      ).length
      const recentMiddleProfile =
        recentMiddleScore &&
        (recentMiddleHitCount >= 2 ||
          (latestRecent3.length >= 2 &&
            latestRecent3Average >= middleScoreMin &&
            latestRecent3Average <= middleScoreMax))
      const hasPersistentLow =
        getRecentValues(scores, tagConfigs.persistentLowScore.recentWindow).filter(
          (score) => score < passLine
        ).length >= (tagConfigs.persistentLowScore.minHitCount || 2)
      const hadEarlierLowPattern =
        scores.slice(0, -2).filter((score) => score < passLine).length >=
        (tagConfigs.lowRecovery.minHitCount || 2)
      const lastTwoScores = getRecentValues(scores, 2)

      if (
        tagConfigs.abnormal.enabled &&
        scores.length >= (tagConfigs.abnormal.minValidScores || 3) &&
        latestScore !== null &&
        historyScores.length >= 2 &&
        latestScore <= averageOf(historyScores) - (tagConfigs.abnormal.abnormalDrop || 12)
      ) {
        matchedTags.push(createTag('abnormal', config))
      }

      if (
        tagConfigs.persistentLowScore.enabled &&
        scores.length >= (tagConfigs.persistentLowScore.minValidScores || 2) &&
        hasPersistentLow
      ) {
        matchedTags.push(createTag('persistentLowScore', config))
      }

      if (tagConfigs.declining.enabled && scores.length >= (tagConfigs.declining.minValidScores || 2)) {
        const recentThreeDescending = latestRecent3.length >= 3 && isStrictlyDescending(latestRecent3)
        const latestBelowAverage =
          latestScore !== null &&
          latestRecent3.length >= 2 &&
          latestScore <= latestRecent3Average - (tagConfigs.declining.minDelta || 8)
        const trendDecline = latestRecent3.length >= 3 && latestTrendDelta <= -(tagConfigs.declining.minDelta || 8)

        if (recentThreeDescending || latestBelowAverage || trendDecline) {
          matchedTags.push(createTag('declining', config))
        }
      }

      if (
        tagConfigs.critical.enabled &&
        latestScore !== null &&
        latestScore >= (tagConfigs.critical.minScore || 55) &&
        latestScore <= (tagConfigs.critical.maxScore || 64)
      ) {
        matchedTags.push(createTag('critical', config))
      }

      if (tagConfigs.lowRecovery.enabled && scores.length >= (tagConfigs.lowRecovery.minValidScores || 3)) {
        const latestRising = lastTwoScores.length === 2 && lastTwoScores[1] > lastTwoScores[0]

        if (hadEarlierLowPattern && latestRising) {
          matchedTags.push(createTag('lowRecovery', config))
        }
      }

      if (tagConfigs.improving.enabled && scores.length >= (tagConfigs.improving.minValidScores || 2)) {
        const recentAscending =
          latestRecent3.length >= 3 ? isStrictlyAscending(latestRecent3) : isStrictlyAscending(scores)
        const recentDelta =
          latestRecent3.length >= 2 ? latestRecent3[latestRecent3.length - 1] - latestRecent3[0] : 0
        const latestAboveAverage =
          latestScore !== null &&
          historyScores.length >= 1 &&
          latestScore >= averageOf(historyScores) + (tagConfigs.improving.minDelta || 8)

        if (recentAscending || recentDelta >= (tagConfigs.improving.minDelta || 8) || latestAboveAverage) {
          matchedTags.push(createTag('improving', config))
        }
      }

      if (
        tagConfigs.middleFalling.enabled &&
        scores.length >= (tagConfigs.middleFalling.minValidScores || 3) &&
        recentMiddleProfile
      ) {
        const fallingDelta =
          latestRecent3.length >= 2 ? latestRecent3[0] - latestRecent3[latestRecent3.length - 1] : 0

        if (
          (latestRecent3.length >= 3 && isStrictlyDescending(latestRecent3)) ||
          fallingDelta >= (tagConfigs.middleFalling.minDelta || 8)
        ) {
          matchedTags.push(createTag('middleFalling', config))
        }
      }

      if (
        tagConfigs.middleRising.enabled &&
        scores.length >= (tagConfigs.middleRising.minValidScores || 3) &&
        recentMiddleProfile
      ) {
        const risingDelta =
          latestRecent3.length >= 2 ? latestRecent3[latestRecent3.length - 1] - latestRecent3[0] : 0

        if (
          (latestRecent3.length >= 3 && isStrictlyAscending(latestRecent3)) ||
          risingDelta >= (tagConfigs.middleRising.minDelta || 8)
        ) {
          matchedTags.push(createTag('middleRising', config))
        }
      }

      if (
        tagConfigs.volatility.enabled &&
        latestRecent4.length >= (tagConfigs.volatility.minValidScores || 3) &&
        recentStdDev >= (tagConfigs.volatility.stdDevThreshold || 10)
      ) {
        matchedTags.push(createTag('volatility', config))
      }

      if (
        tagConfigs.stableTop.enabled &&
        points.length >= (tagConfigs.stableTop.minValidScores || 3) &&
        stableTopRecentCount >= (tagConfigs.stableTop.minTopRankHits || 2)
      ) {
        matchedTags.push(createTag('stableTop', config))
      }

      return {
        name,
        student,
        points,
        averageScore: Number(averageOf(scores).toFixed(2)),
        latestScore,
        previousScore,
        historyAverage: historyScores.length ? Number(averageOf(historyScores).toFixed(2)) : null,
        latestDelta,
        latestDrop,
        scoreRange: Math.max(...scores) - Math.min(...scores),
        lowScoreCount: scores.filter((score) => score < passLine).length,
        stableTopRecentCount,
        recentScores,
        recentThreeScores,
        recentFourScores,
        recentAverage: recentScores.length ? Number(averageOf(recentScores).toFixed(2)) : null,
        recentStdDev: Number(recentStdDev.toFixed(2)),
        volatilityDirection,
        matchedTags: matchedTags
          .filter((tag, index, array) => array.findIndex((current) => current.key === tag.key) === index)
          .sort((a, b) => a.priority - b.priority)
      } satisfies StudentMetricType
    })
    .filter((item): item is StudentMetricType => item !== null)
}
