/** 学生趋势信号与重叠标签抑制规则。 */
import {
  isStrictlyAscending,
  isStrictlyDescending
} from '@/views/overview/services/dashboard/helpers'

import type {
  StudentMetricType,
  StudentSignalSnapshotType
} from '@/views/overview/services/dashboard/types'

/**
 * 对学生标签做“近义去重”，避免同一种风险在多个栏目重复出现。
 *
 * 设计原则：
 * - 保留真正有价值的多标签叠加，例如“持续低分 + 下滑关注”
 * - 只压掉语义高度重叠、会让老师误以为是不同问题的组合
 * - 方向结论和变化型标签必须使用同一套语言，避免出现相互打架的解释
 *
 * 当前抑制规则：
 * - abnormal 会覆盖 declining / middleFalling：单次异常失常比“近期下滑 / 中段下滑”解释力更强
 * - persistentLowScore 会覆盖 critical：长期低位比“贴近及格线”更值得优先表述
 * - persistentLowScore / critical 会覆盖 middleFalling：已经进入风险区后，不再归为普通中段变化
 * - upward direction 会覆盖 declining / middleFalling：当前方向更接近走强，不再保留反向趋势标签
 * - downward direction 会覆盖 improving / lowRecovery / middleRising：当前方向更接近走弱，不再保留反向趋势标签
 *
 * 为什么不做“完全单标签化”：
 * - 像“持续低分 + 下滑关注”这种组合，老师确实需要同时知道“本来就低”和“还在继续恶化”
 * - 但像“波动上行 + 下滑关注”这种组合，本质是在用两种相反语言描述同一段趋势，必须在这里收口
 */
export const normalizeMatchedTags = (
  matchedTags: StudentMetricType['matchedTags'],
  volatilityDirection: StudentMetricType['volatilityDirection']
): StudentMetricType['matchedTags'] => {
  const uniqueMatchedTags = matchedTags.filter(
    (tag, index, array) => array.findIndex((current) => current.key === tag.key) === index
  )
  const tagKeys = new Set(uniqueMatchedTags.map((tag) => tag.key))
  const suppressedTagKeys = new Set<string>()
  const isUpwardDirection = volatilityDirection === 'up' || volatilityDirection === 'volatileUp'
  const isDownwardDirection =
    volatilityDirection === 'down' || volatilityDirection === 'volatileDown'

  if (tagKeys.has('abnormal')) {
    // “突发异常”已经明确说明是一次性明显失常，不再重复挂“下滑关注”。
    suppressedTagKeys.add('declining')
    // 已经是单次异常失常，不再归入常规的“中段下滑”观察。
    suppressedTagKeys.add('middleFalling')
  }

  if (tagKeys.has('persistentLowScore')) {
    // 长期低位比“临界”更重，老师优先看到“持续低分”即可。
    suppressedTagKeys.add('critical')
    // 已进入低分风险区后，不再归入普通的“中段下滑”。
    suppressedTagKeys.add('middleFalling')
  }

  if (tagKeys.has('critical')) {
    // “临界生”属于更直接的风险表达，会覆盖教学观察性质的“中段下滑”。
    suppressedTagKeys.add('middleFalling')
  }

  /**
   * 趋势方向与变化型标签必须保持一致，避免出现“图标说上行，标签却说下滑”的冲突。
   *
   * 这里的方向结论来自“难度修正后的分数序列”，因此可以被视为趋势层的总判断。
   * 归一化时，所有会表达“当前更接近变好/变差”的标签，都必须服从这个总判断。
   *
   * 例子：
   * - 35 -> 91 -> 32，若修正后整体更接近波动上行，则应保留“波动上行”，抑制“下滑关注”
   * - 46 -> 88 -> 69，若修正后整体仍显著高于起点，则可以保留上行方向，不再同时挂“中段下滑”
   */
  if (isUpwardDirection) {
    // 当前走势更接近走强时，不再保留任何“当前更接近走弱”的趋势标签。
    suppressedTagKeys.add('declining')
    suppressedTagKeys.add('middleFalling')
  }

  if (isDownwardDirection) {
    // 当前走势更接近走弱时，不再保留任何“当前更接近走强”的趋势标签。
    suppressedTagKeys.add('improving')
    suppressedTagKeys.add('lowRecovery')
    suppressedTagKeys.add('middleRising')
  }

  return uniqueMatchedTags
    .filter((tag) => !suppressedTagKeys.has(tag.key))
    .sort((a, b) => a.priority - b.priority)
}

/**
 * 构建学生趋势信号层。
 *
 * 这层不直接产出标签，只负责把“当前发生了什么”整理成一组标准化信号，
 * 供后续多个标签复用。这样做有三个直接收益：
 * 1. 避免每个标签重复计算同一类趋势条件
 * 2. 让方向、区间、低位修复等概念使用统一口径
 * 3. 后续调规则时，可以先看信号，再看标签组合，排错更直接
 *
 * 当前重点抽出的信号包括：
 * - 方向类：当前总体更接近向上还是向下
 * - 动量类：最近一次是继续上冲还是已经回落
 * - 幅度类：最近三次累计涨跌是否达到阈值
 * - 区间类：当前是否仍属于中段画像、是否仍处在低位修复区
 */
export const buildStudentSignals = ({
  normalizedLatestScore,
  previousScore,
  normalizedLatestRecent3,
  latestRecent3Average,
  volatilityDirection,
  hadEarlierLowPattern,
  recentMiddleProfile,
  minDecliningDelta,
  minDecliningCumulativeDrop,
  minDecliningSingleDrop,
  minImprovingDelta,
  passLine
}: {
  /** 难度修正后的最新成绩 */
  normalizedLatestScore: number | null
  /** 难度修正后的上一次成绩 */
  previousScore: number | null
  /** 难度修正后的最近 3 次成绩 */
  normalizedLatestRecent3: number[]
  /** 最近 3 次归一化成绩的均分 */
  latestRecent3Average: number
  /** 走势方向（基于修正后序列） */
  volatilityDirection: StudentMetricType['volatilityDirection']
  /** 前期历史成绩是否出现过持续低分 */
  hadEarlierLowPattern: boolean
  /** 当前是否仍属于中段画像 */
  recentMiddleProfile: boolean
  /** 下滑关注标签：相对近期均值的显著下降阈值 */
  minDecliningDelta: number
  /** 下滑关注标签：连续下滑累计跌幅阈值 */
  minDecliningCumulativeDrop: number
  /** 下滑关注标签：单次下滑幅度阈值 */
  minDecliningSingleDrop: number
  /** 进步明显标签：显著进步的最小提升幅度 */
  minImprovingDelta: number
  /** 及格线 */
  passLine: number
}): StudentSignalSnapshotType => {
  const isUpwardDirection = volatilityDirection === 'up' || volatilityDirection === 'volatileUp'
  const isDownwardDirection =
    volatilityDirection === 'down' || volatilityDirection === 'volatileDown'
  const recentAscending =
    normalizedLatestRecent3.length >= 3 && isStrictlyAscending(normalizedLatestRecent3)
  const recentDescending =
    normalizedLatestRecent3.length >= 3 && isStrictlyDescending(normalizedLatestRecent3)
  const recentDelta =
    normalizedLatestRecent3.length >= 2
      ? normalizedLatestRecent3[normalizedLatestRecent3.length - 1] - normalizedLatestRecent3[0]
      : 0
  const risingDelta = Math.max(0, recentDelta)
  const fallingDelta = Math.max(0, recentDelta * -1)
  const latestMomentum =
    normalizedLatestScore !== null && previousScore !== null
      ? normalizedLatestScore - previousScore
      : 0
  const latestMomentumUp = latestMomentum > 0
  const latestMomentumDown = latestMomentum < 0
  const hasSignificantContinuousDecline =
    recentDescending && fallingDelta >= minDecliningCumulativeDrop
  const hasSignificantSingleDrop =
    latestMomentumDown && Math.abs(latestMomentum) >= minDecliningSingleDrop
  const latestAboveAverage =
    normalizedLatestScore !== null &&
    normalizedLatestRecent3.length >= 2 &&
    normalizedLatestScore >= latestRecent3Average + minImprovingDelta
  const latestBelowAverage =
    normalizedLatestScore !== null &&
    normalizedLatestRecent3.length >= 2 &&
    normalizedLatestScore <= latestRecent3Average - minDecliningDelta
  const trendDecline = normalizedLatestRecent3.length >= 3 && recentDelta <= -minDecliningDelta
  const latestRising = latestMomentumUp
  /**
   * “低位回升”必须仍处在低位修复区，不能把已经回到中高位的学生继续算成低位恢复。
   *
   * 这里采用一个保守区间：
   * - 下限为及格线：低于及格线更像低位波动，不足以称为“回升”
   * - 上限为 75 分：超过后更像一般进步或正常波动，不再强调“低位”
   */
  const lowRecoveryScoreEligible =
    normalizedLatestScore !== null &&
    normalizedLatestScore >= passLine &&
    normalizedLatestScore <= passLine + 15

  return {
    isUpwardDirection,
    isDownwardDirection,
    latestMomentumUp,
    latestMomentumDown,
    recentAscending,
    recentDescending,
    recentDelta,
    risingDelta,
    fallingDelta,
    latestAboveAverage,
    latestBelowAverage,
    hasSignificantContinuousDecline,
    hasSignificantSingleDrop,
    trendDecline,
    recentMiddleProfile,
    hadEarlierLowPattern,
    latestRising,
    lowRecoveryScoreEligible
  }
}
