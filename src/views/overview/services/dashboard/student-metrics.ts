/** 学生成绩画像与标签匹配。 */
import {
  averageOf,
  buildRankMapByUnit,
  createTag,
  getNumericScore,
  getRecentValues,
  getStudentName,
  getVolatilityDirection,
  standardDeviationOf
} from '@/views/overview/services/dashboard/helpers'
import { buildUnitDifficultyShiftMap } from './unit-metrics'
import { normalizeMatchedTags, buildStudentSignals } from './student-signals'

import type { OverviewDashboardConfigType } from '@/types/OverviewDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import type {
  StudentMetricType,
  StudentPointType,
  UnitMetricType
} from '@/views/overview/services/dashboard/types'

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
 * - declining（下滑关注）：连续下滑且累计跌幅明显，或单次出现较大下滑
 * - critical（临界生）：分数在 55-64 之间，接近及格线
 * - lowRecovery（低位回升）：前期低分但最近开始回升
 * - improving（进步明显）：近期持续进步或明显高于历史均分
 * - middleFalling（中段下滑）：处于中段但持续退步
 * - middleRising（中段上升）：处于中段但持续进步
 * - volatility（波动生）：标准差较大，成绩不稳定
 * - stableTop（高分稳定）：长期处于班级前列
 *
 * @param students 学生数据列表
 * @param unitHeaders 单元表头配置
 * @param unitMetrics 单元维度统计列表（用于难度修正）
 * @param config 总览页配置
 * @returns 学生画像列表（仅包含有有效成绩的学生）
 */
export const buildStudentMetrics = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  unitMetrics: UnitMetricType[],
  config: OverviewDashboardConfigType
): StudentMetricType[] => {
  // 预构建班级排名映射，避免在循环中重复计算
  const rankMapByUnit = buildRankMapByUnit(students, unitHeaders)
  const passLine = config.tagRules.passLine
  const middleScoreMin = config.tagRules.middleScoreMin
  const middleScoreMax = config.tagRules.middleScoreMax
  const unitDifficultyShiftMap = buildUnitDifficultyShiftMap(unitMetrics, config)

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
            rank:
              rankMapByUnit
                .find((item) => item.prop === header.prop)
                ?.rankMap.get(student.studentId) || null,
            difficultyShift: unitDifficultyShiftMap.get(header.prop)?.difficultyShift || 'normal'
          } satisfies StudentPointType
        })
        .filter((item): item is StudentPointType => item !== null)

      // 无有效成绩的学生不参与统计
      if (!points.length) return null

      const scores = points.map((point) => point.score)
      const latestScore = scores.length ? scores[scores.length - 1] : null
      const previousScore = scores.length >= 2 ? scores[scores.length - 2] : null
      /**
       * 难度修正后的成绩序列：
       * - 最近单元整体偏易：扣回班均上浮部分，避免把“全班普涨”误判成个人进步
       * - 最近单元整体偏难：补回班均下探部分，避免把“全班普跌”误判成个人退步
       * - 所有单元使用同一修正口径，避免用“修正后的最新分”去比较“未修正的上一分”
       */
      const normalizedScores = points.map((point) =>
        Number((point.score - (unitDifficultyShiftMap.get(point.prop)?.shift || 0)).toFixed(2))
      )
      const normalizedLatestScore = normalizedScores.length
        ? normalizedScores[normalizedScores.length - 1]
        : null
      const normalizedPreviousScore =
        normalizedScores.length >= 2 ? normalizedScores[normalizedScores.length - 2] : null
      // 历史成绩（不含最新一次），用于计算较历史均分的差值
      const historyScores = scores.slice(0, -1)
      const tagConfigs = config.tagRules.tags

      // 近期成绩滑动窗口：原始分数用于展示，归一化分数用于趋势和标签判定
      const recentScores = getRecentValues(scores, 4)
      const recentThreeScores = getRecentValues(scores, 3)
      const recentFourScores = getRecentValues(scores, tagConfigs.volatility.recentWindow)
      const normalizedRecentScores = getRecentValues(normalizedScores, 4)
      const normalizedRecentThreeScores = getRecentValues(normalizedScores, 3)
      const normalizedRecentFourScores = getRecentValues(
        normalizedScores,
        tagConfigs.volatility.recentWindow
      )

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

      // 命中的标签，允许多重命中，最终在归一化层统一收口语义冲突
      const matchedTags = []
      const normalizedLatestRecent3 = normalizedRecentThreeScores
      const normalizedLatestRecent4 = normalizedRecentFourScores
      const normalizedLatestRecentScores = normalizedRecentScores
      const latestRecent3Average = averageOf(normalizedLatestRecent3)
      // 最近 4 次成绩的标准差
      const recentStdDev = standardDeviationOf(normalizedLatestRecent4)
      /**
       * 波动方向与标签命中共用同一套“难度修正后”序列，保证语义一致：
       * - 原始分数继续展示给老师看
       * - 单元偏难 / 偏易通过分数颜色提示
       * - 方向图标和标签都表达“扣除试卷难易后的真实走势”
       *
       * 这样可以避免“标签说不算真实进步，但图标又显示上行”这类冲突。
       */
      const volatilityDirection = getVolatilityDirection(normalizedLatestRecent3)

      // 中段判断：该学生是否处于班级中间层（60-84 分）
      const recentMiddleScore =
        normalizedLatestScore !== null &&
        normalizedLatestScore >= middleScoreMin &&
        normalizedLatestScore <= middleScoreMax
      const recentMiddleHitCount = normalizedLatestRecent3.filter(
        (score) => score >= middleScoreMin && score <= middleScoreMax
      ).length
      // 符合中段画像：当前中段且近期大部分也在中段，或近期均分在中段
      const recentMiddleProfile =
        recentMiddleScore &&
        (recentMiddleHitCount >= 2 ||
          (normalizedLatestRecent3.length >= 2 &&
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
      const signals = buildStudentSignals({
        normalizedLatestScore,
        previousScore: normalizedPreviousScore,
        normalizedLatestRecent3,
        latestRecent3Average,
        volatilityDirection,
        hadEarlierLowPattern,
        recentMiddleProfile,
        minDecliningDelta: tagConfigs.declining.minDelta || 8,
        minDecliningCumulativeDrop: tagConfigs.declining.minCumulativeDrop || 5,
        minDecliningSingleDrop: tagConfigs.declining.minSingleDrop || 5,
        minImprovingDelta: tagConfigs.improving.minDelta || 8,
        passLine
      })

      // ========== 标签匹配规则 ==========

      // 1. abnormal（突发异常）：最新成绩明显低于历史水平
      if (
        tagConfigs.abnormal.enabled &&
        scores.length >= (tagConfigs.abnormal.minValidScores || 3) &&
        normalizedLatestScore !== null &&
        historyScores.length >= 2 &&
        normalizedLatestScore <= averageOf(historyScores) - (tagConfigs.abnormal.abnormalDrop || 12)
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

      // 3. declining（下滑关注）：避免把轻微自然波动误判成重点关注
      if (
        tagConfigs.declining.enabled &&
        scores.length >= (tagConfigs.declining.minValidScores || 3)
      ) {
        /**
         * 命中任一条件即进入“下滑关注”：
         * 1. 最近 3 次连续下降，且累计跌幅达到阈值
         *    例：100 -> 97 -> 92，累计下降 8 分，属于明确下滑
         * 2. 最近一次相较上一单元单次急跌
         *    例：88 -> 80，虽然不是三连降，但也值得关注
         * 3. 最新成绩明显低于近期均值或近期整体趋势降幅过大
         *
         * 像 91 -> 90 -> 88 这种虽然是连续下降，但累计只降 3 分，
         * 会被视作轻微波动，不再直接归入“下滑关注”。
         */
        if (
          signals.hasSignificantContinuousDecline ||
          signals.hasSignificantSingleDrop ||
          signals.latestBelowAverage ||
          signals.trendDecline
        ) {
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

      /**
       * 5. lowRecovery（低位回升）
       *
       * 低位回升不等于“曾经低过 + 最近涨了一点”。
       * 真正需要保留这个标签的，是仍然处在低位修复通道中的学生：
       * - 前期确实有持续低位
       * - 当前方向仍然向上
       * - 最近一次还在继续回升
       * - 当前分数仍属于“低位修复区”
       *
       * 这能避免把 75 -> 86 -> 83 这类中高位波动误贴成“低位回升”。
       */
      if (
        tagConfigs.lowRecovery.enabled &&
        scores.length >= (tagConfigs.lowRecovery.minValidScores || 3)
      ) {
        if (
          signals.hadEarlierLowPattern &&
          signals.isUpwardDirection &&
          signals.latestRising &&
          signals.lowRecoveryScoreEligible
        ) {
          matchedTags.push(createTag('lowRecovery', config))
        }
      }

      /**
       * 6. improving（进步明显）
       *
       * 这个标签强调“当前仍在变好”，不是“中间曾经冲高过”。
       * 因此除了整体涨幅，还必须满足：
       * - 当前方向为向上
       * - 最近一次动量也仍为向上
       *
       * 这样像 44 -> 88 -> 69、75 -> 86 -> 83 这类先升后回落的走势，
       * 就不会继续被算成“进步明显”。
       */
      if (
        tagConfigs.improving.enabled &&
        scores.length >= (tagConfigs.improving.minValidScores || 2)
      ) {
        const latestAboveHistoryAverage =
          normalizedLatestScore !== null &&
          historyScores.length >= 1 &&
          normalizedLatestScore >= averageOf(historyScores) + (tagConfigs.improving.minDelta || 8)
        // 原始分数的累计提升（用于排除归一化后"假进步"的情况）
        const actualRecentDelta =
          recentThreeScores.length >= 2
            ? recentThreeScores[recentThreeScores.length - 1] - recentThreeScores[0]
            : 0

        if (
          signals.isUpwardDirection &&
          signals.latestMomentumUp &&
          actualRecentDelta > 0 &&
          (signals.risingDelta >= (tagConfigs.improving.minDelta || 8) || latestAboveHistoryAverage)
        ) {
          matchedTags.push(createTag('improving', config))
        }
      }

      /**
       * 7. middleFalling（中段下滑）
       *
       * 中段下滑强调“当前更接近往下掉”，所以除了中段画像外，
       * 还要求方向和最近一次动量都已经转弱。
       */
      if (
        tagConfigs.middleFalling.enabled &&
        scores.length >= (tagConfigs.middleFalling.minValidScores || 3) &&
        signals.recentMiddleProfile
      ) {
        if (
          signals.isDownwardDirection &&
          signals.latestMomentumDown &&
          (signals.recentDescending ||
            signals.fallingDelta >= (tagConfigs.middleFalling.minDelta || 8))
        ) {
          matchedTags.push(createTag('middleFalling', config))
        }
      }

      /**
       * 8. middleRising（中段上升）
       *
       * 与 middleFalling 对称：只有当前方向向上、最近一次也还在继续向上，
       * 才保留“中段上升”。
       */
      if (
        tagConfigs.middleRising.enabled &&
        scores.length >= (tagConfigs.middleRising.minValidScores || 3) &&
        signals.recentMiddleProfile
      ) {
        if (
          signals.isUpwardDirection &&
          signals.latestMomentumUp &&
          (signals.recentAscending ||
            signals.risingDelta >= (tagConfigs.middleRising.minDelta || 8))
        ) {
          matchedTags.push(createTag('middleRising', config))
        }
      }

      // 9. volatility（波动生）：成绩起伏大，状态不稳定
      if (
        tagConfigs.volatility.enabled &&
        normalizedLatestRecent4.length >= (tagConfigs.volatility.minValidScores || 3) &&
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
        studentId: student.studentId,
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
        recentAverage: normalizedLatestRecentScores.length
          ? Number(averageOf(normalizedLatestRecentScores).toFixed(2))
          : null,
        recentStdDev: Number(recentStdDev.toFixed(2)),
        volatilityDirection,
        // 标签允许多命中，但最终会在归一化层统一收口语义冲突与近义重复
        matchedTags: normalizeMatchedTags(matchedTags, volatilityDirection)
      } satisfies StudentMetricType
    })
    .filter((item): item is StudentMetricType => item !== null)
}
