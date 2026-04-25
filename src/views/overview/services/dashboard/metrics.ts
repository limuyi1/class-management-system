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
 *
 * 输入：学生数据列表、配置的表头（单元列表）、全局配置
 * 处理：按单元分组，计算每个单元的均分、低分人数、标准差、分数段分布
 * 输出：UnitMetricType[]，每个单元的汇总统计数据
 *
 * 注意：只返回有有效成绩的单元（validCount > 0）
 */
export const buildUnitMetrics = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  config: HomeDashboardConfigType
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
          count: scores.filter((score) => score >= band.min && score <= band.max).length
        }))
      }
    })
    .filter((item) => item.validCount > 0)
}

/**
 * 生成学生维度画像，后续所有标签、推荐和趋势分析都基于这层中间结果。
 *
 * 输入：学生数据列表、表头配置、全局配置
 * 处理：
 *   1. 构建每个学生的成绩序列（points）和班级排名
 *   2. 计算各类统计指标：均分、近期均分、波动方向等
 *   3. 根据标签规则匹配学生标签（共 10 种标签）
 * 输出：StudentMetricType[]，每个学生的画像数据和匹配标签
 *
 * 标签匹配规则说明：
 * - abnormal（突发异常）：最新成绩明显低于历史水平（降幅 >= 12 分）
 * - persistentLowScore（持续低分）：最近多次都是低分
 * - declining（下滑关注）：持续下滑，低于近期均分
 * - critical（临界生）：分数在 55-64 之间，接近及格线
 * - lowRecovery（低位回升）：前期低分但最近开始回升
 * - improving（进步明显）：近期持续进步或明显高于历史均分
 * - middleFalling（中段下滑）：处于中段但持续退步
 * - middleRising（中段上升）：处于中段但持续进步
 * - volatility（波动生）：标准差较大，成绩不稳定
 * - stableTop（高分稳定）：长期处于班级前列
 */
export const buildStudentMetrics = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  config: HomeDashboardConfigType
): StudentMetricType[] => {
  // 预构建班级排名映射，避免在循环中重复计算
  const rankMapByUnit = buildRankMapByUnit(students, unitHeaders)
  const passLine = config.tagRules.passLine
  const middleScoreMin = config.tagRules.middleScoreMin
  const middleScoreMax = config.tagRules.middleScoreMax

  return students
    .map((student) => {
      const name = getStudentName(student)
      // 构建该学生的成绩序列，包含分数和班级排名
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

      // 无有效成绩的学生不参与统计
      if (!points.length) return null

      const scores = points.map((point) => point.score)
      const latestScore = scores.length ? scores[scores.length - 1] : null
      const previousScore = scores.length >= 2 ? scores[scores.length - 2] : null
      // 历史成绩（不含最新一次），用于计算较历史均分的差值
      const historyScores = scores.slice(0, -1)
      const tagConfigs = config.tagRules.tags

      // 近期成绩滑动窗口：最近 4 次、最近 3 次、最近 4 次
      const recentScores = getRecentValues(scores, 4)
      const recentThreeScores = getRecentValues(scores, 3)
      const recentFourScores = getRecentValues(scores, tagConfigs.volatility.recentWindow)

      // 最新成绩与历史均分的差值：正数表示高于平均，负数表示低于平均
      const latestDelta =
        latestScore !== null && historyScores.length
          ? Number((latestScore - averageOf(historyScores)).toFixed(2))
          : 0
      // 最新成绩较上一次的下降幅度
      const latestDrop =
        latestScore !== null && previousScore !== null && latestScore < previousScore
          ? Number((previousScore - latestScore).toFixed(2))
          : 0

      // 稳定前列统计：最近几次中进入班级前 N 名的次数
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
      // 最近 3 次成绩的总体变化量
      const latestTrendDelta =
        latestRecent3.length >= 2 ? latestRecent3[latestRecent3.length - 1] - latestRecent3[0] : 0
      // 最近 4 次成绩的标准差
      const recentStdDev = standardDeviationOf(latestRecent4)
      const volatilityDirection = getVolatilityDirection(latestRecent3)

      // 中段判断：该学生是否处于班级中间层（60-84 分）
      const recentMiddleScore =
        latestScore !== null && latestScore >= middleScoreMin && latestScore <= middleScoreMax
      const recentMiddleHitCount = latestRecent3.filter(
        (score) => score >= middleScoreMin && score <= middleScoreMax
      ).length
      // 符合中段画像：当前中段且近期大部分也在中段，或近期均分在中段
      const recentMiddleProfile =
        recentMiddleScore &&
        (recentMiddleHitCount >= 2 ||
          (latestRecent3.length >= 2 &&
            latestRecent3Average >= middleScoreMin &&
            latestRecent3Average <= middleScoreMax))

      // 持续低分判断：最近 N 次中有 M 次低于及格线
      const hasPersistentLow =
        getRecentValues(scores, tagConfigs.persistentLowScore.recentWindow).filter(
          (score) => score < passLine
        ).length >= (tagConfigs.persistentLowScore.minHitCount || 2)
      // 低位回升判断：前期的历史成绩中曾出现低分
      const hadEarlierLowPattern =
        scores.slice(0, -2).filter((score) => score < passLine).length >=
        (tagConfigs.lowRecovery.minHitCount || 2)
      const lastTwoScores = getRecentValues(scores, 2)

      // ========== 标签匹配规则 ==========

      // 1. abnormal（突发异常）：最新成绩明显低于历史水平
      if (
        tagConfigs.abnormal.enabled &&
        scores.length >= (tagConfigs.abnormal.minValidScores || 3) &&
        latestScore !== null &&
        historyScores.length >= 2 &&
        latestScore <= averageOf(historyScores) - (tagConfigs.abnormal.abnormalDrop || 12)
      ) {
        matchedTags.push(createTag('abnormal', config))
      }

      // 2. persistentLowScore（持续低分）：最近多次低分状态
      if (
        tagConfigs.persistentLowScore.enabled &&
        scores.length >= (tagConfigs.persistentLowScore.minValidScores || 2) &&
        hasPersistentLow
      ) {
        matchedTags.push(createTag('persistentLowScore', config))
      }

      // 3. declining（下滑关注）：持续下滑，低于个人正常水平
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

      // 4. critical（临界生）：接近及格线，稍加辅导有机会跨线
      if (
        tagConfigs.critical.enabled &&
        latestScore !== null &&
        latestScore >= (tagConfigs.critical.minScore || 55) &&
        latestScore <= (tagConfigs.critical.maxScore || 64)
      ) {
        matchedTags.push(createTag('critical', config))
      }

      // 5. lowRecovery（低位回升）：原本低分但最近开始回升
      if (tagConfigs.lowRecovery.enabled && scores.length >= (tagConfigs.lowRecovery.minValidScores || 3)) {
        const latestRising = lastTwoScores.length === 2 && lastTwoScores[1] > lastTwoScores[0]

        if (hadEarlierLowPattern && latestRising) {
          matchedTags.push(createTag('lowRecovery', config))
        }
      }

      // 6. improving（进步明显）：持续进步或明显高于历史水平
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

      // 7. middleFalling（中段下滑）：中段学生但持续退步
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

      // 8. middleRising（中段上升）：中段学生但持续进步
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

      // 9. volatility（波动生）：成绩起伏大，状态不稳定
      if (
        tagConfigs.volatility.enabled &&
        latestRecent4.length >= (tagConfigs.volatility.minValidScores || 3) &&
        recentStdDev >= (tagConfigs.volatility.stdDevThreshold || 10)
      ) {
        matchedTags.push(createTag('volatility', config))
      }

      // 10. stableTop（高分稳定）：长期处于班级前列
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
        // 标签去重（同一学生可能同时匹配多个标签）并按优先级排序
        matchedTags: matchedTags
          .filter((tag, index, array) => array.findIndex((current) => current.key === tag.key) === index)
          .sort((a, b) => a.priority - b.priority)
      } satisfies StudentMetricType
    })
    .filter((item): item is StudentMetricType => item !== null)
}
