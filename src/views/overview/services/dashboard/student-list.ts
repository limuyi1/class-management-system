import type {
  DashboardFocusSectionKeyType,
  DashboardFocusGroupKeyType,
  DashboardStudentListItemType,
  DashboardTagKeyType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'

import {
  buildTrendSegments,
  formatScore,
  formatTrendText,
  getRecentChange,
  getScoreDiffText
} from '@/views/overview/services/dashboard/helpers'
import type { StudentMetricType } from '@/views/overview/services/dashboard/types'

const scoresToHitCount = (scores: number[], passLine: number): number =>
  scores.filter((score) => score < passLine).length

const isDownwardDirection = (direction?: StudentMetricType['volatilityDirection']) =>
  direction === 'down' || direction === 'volatileDown'

const isUpwardDirection = (direction?: StudentMetricType['volatilityDirection']) =>
  direction === 'up' || direction === 'volatileUp'

/**
 * 为同一标签内的学生计算推荐排序分数。
 *
 * 各标签的排序策略：
 * - abnormal：按降幅倒序，降幅越大越优先
 * - persistentLowScore：低分次数越多越优先
 * - declining：按下滑幅度倒序
 * - critical：按距离及格线的差距倒序，差得越多越优先
 * - lowRecovery：按回升幅度和历史低分次数加权
 * - improving：按提升幅度倒序
 * - middleFalling：按下探幅度倒序
 * - middleRising：按上升幅度倒序
 * - volatility：按标准差、极差、波动方向综合计算
 * - stableTop：按前列次数和最新成绩加权
 */
export const getTagSortScore = (
  metric: StudentMetricType,
  tagKey: DashboardTagKeyType,
  config: HomeDashboardConfigType
): number => {
  const recentChange = getRecentChange(metric.recentThreeScores)

  switch (tagKey) {
    case 'abnormal':
      return Number(Math.max(0, metric.latestDelta * -1).toFixed(2))
    case 'persistentLowScore':
      return Number(
        (
          metric.recentThreeScores.filter((score) => score < config.tagRules.passLine).length * 10 +
          Math.max(0, config.tagRules.passLine - (metric.latestScore || 0))
        ).toFixed(2)
      )
    case 'declining':
      return Number(Math.max(metric.latestDrop, Math.max(0, recentChange * -1)).toFixed(2))
    case 'critical':
      return Number((100 - (metric.latestScore || 0)).toFixed(2))
    case 'lowRecovery':
      return Number(
        (
          Math.max(0, recentChange) +
          scoresToHitCount(metric.points.map((point) => point.score).slice(0, -2), config.tagRules.passLine) * 2
        ).toFixed(2)
      )
    case 'improving':
      return Number(Math.max(Math.max(0, recentChange), Math.max(0, metric.latestDelta)).toFixed(2))
    case 'middleFalling':
      return Number(Math.max(0, recentChange * -1).toFixed(2))
    case 'middleRising':
      return Number(Math.max(0, recentChange).toFixed(2))
    case 'volatility':
      return Number(
        (
          metric.recentStdDev * 10 +
          metric.scoreRange +
          (isDownwardDirection(metric.volatilityDirection)
            ? 8
            : isUpwardDirection(metric.volatilityDirection)
              ? 4
              : 0)
        ).toFixed(2)
      )
    case 'stableTop':
      return Number((metric.stableTopRecentCount * 20 + (metric.latestScore || 0)).toFixed(2))
    default:
      return 0
  }
}

/**
 * 为学生生成"原因文案"，即该学生被标记此标签的具体说明。
 *
 * 各标签的文案逻辑：
 * - abnormal：显示较历史均分的降幅
 * - persistentLowScore：显示最近低分次数
 * - declining：显示较上次的下降幅度
 * - critical：显示当前分数和及格线的关系
 * - lowRecovery：描述回升趋势
 * - improving：显示累计提升分数
 * - middleFalling/middleRising：描述中段变化趋势
 * - volatility：区分上行/下行波动
 * - stableTop：显示进入前五的次数
 */
export const buildReasonText = (
  metric: StudentMetricType,
  preferredTagKey?: DashboardTagKeyType
): string => {
  const primaryTag = preferredTagKey
    ? metric.matchedTags.find((tag) => tag.key === preferredTagKey) || metric.matchedTags[0]
    : metric.matchedTags[0]

  if (!primaryTag) return '最近阶段暂无明显变化'

  switch (primaryTag.key) {
    case 'abnormal':
      return `最近一次较个人近期水平低 ${getScoreDiffText(metric.latestDelta)} 分，存在异常下滑`
    case 'persistentLowScore': {
      const recentLowHits = metric.recentThreeScores.filter((score) => score < 60).length
      return `最近 3 次中有 ${recentLowHits} 次低于 60 分，低分状态持续`
    }
    case 'declining':
      return `最近阶段持续走低，最近一次较上一单元下降 ${getScoreDiffText(metric.latestDrop)} 分`
    case 'critical':
      return `最近一次为 ${formatScore(metric.latestScore || 0)} 分，已接近及格线`
    case 'lowRecovery':
      return '前期出现低分后，最近阶段开始回升，提升趋势已出现'
    case 'improving':
      return `最近 3 次累计提升 ${formatScore(Math.max(0, metric.recentThreeScores.slice(-1)[0] - metric.recentThreeScores[0]))} 分，进步明显`
    case 'middleFalling':
      return '当前仍处中段，但最近阶段持续下降，需要提前干预'
    case 'middleRising':
      return '当前仍处中段，但最近阶段稳步上升，值得继续观察'
    case 'volatility':
      return isUpwardDirection(metric.volatilityDirection)
        ? '最近几次起伏较大，当前更接近波动上行'
        : '最近几次起伏较大，当前更接近波动下行'
    case 'stableTop':
      return `最近 3 次中有 ${metric.stableTopRecentCount} 次进入班级前五，表现稳定`
    default:
      return primaryTag.description
  }
}

/**
 * 将学生画像转换为列表展示项。
 *
 * 若传入 preferredTagKey，则该标签优先作为主标签显示。
 * 次级标签显示在副标题位置。
 * 标签按优先级排序后决定主次关系。
 */
export const toStudentListItem = (
  metric: StudentMetricType,
  preferredTagKey?: DashboardTagKeyType
): DashboardStudentListItemType | null => {
  if (!metric.matchedTags.length) return null

  const orderedTags = preferredTagKey
    ? [
        ...metric.matchedTags.filter((tag) => tag.key === preferredTagKey),
        ...metric.matchedTags.filter((tag) => tag.key !== preferredTagKey)
      ]
    : metric.matchedTags
  const primaryTag = orderedTags[0]
  const secondaryTags = orderedTags.slice(1)

  return {
    name: metric.name,
    trendText: formatTrendText(metric.recentThreeScores),
    trendSegments: buildTrendSegments(metric.points.slice(-metric.recentThreeScores.length)),
    subtitle:
      secondaryTags.length > 0
        ? secondaryTags.map((tag) => tag.label).join('、')
        : primaryTag.description,
    badge: primaryTag.label,
    reasonText: buildReasonText(metric, preferredTagKey),
    volatilityDirection: metric.volatilityDirection || undefined,
    primaryTag,
    secondaryTags
  }
}

/**
 * 获取波动标签的细分元数据。
 *
 * 波动标签根据 volatilityDirection 细分为两个 section：
 * - volatilityRising：波动上行
 * - volatilityFalling：波动下行
 * 其他标签不做细分。
 */
export const getSectionMeta = (
  tagKey: DashboardTagKeyType,
  metric?: StudentMetricType
): { key: DashboardFocusSectionKeyType; label: string; description: string } => {
  if (tagKey !== 'volatility') {
    return {
      key: tagKey,
      label: '',
      description: ''
    }
  }

  if (isUpwardDirection(metric?.volatilityDirection)) {
    return {
      key: 'volatilityRising',
      label: '波动上行',
      description: '最近几次有明显起伏，但当前走势更接近向上修复'
    }
  }

  return {
    key: 'volatilityFalling',
    label: '波动下行',
    description: '最近几次有明显起伏，且当前走势更接近继续下探'
  }
}

/**
 * 获取学生在中段变化中的显示 Key。
 *
 * 优先级：middleFalling > middleRising > volatility > 默认
 * 用于波动观察组内的细分排序。
 */
export const getMiddleChangeDisplayKey = (metric: StudentMetricType): DashboardFocusSectionKeyType => {
  if (metric.matchedTags.some((tag) => tag.key === 'middleFalling')) {
    return 'middleFalling'
  }

  if (metric.matchedTags.some((tag) => tag.key === 'middleRising')) {
    return 'middleRising'
  }

  if (metric.matchedTags.some((tag) => tag.key === 'volatility')) {
    return isUpwardDirection(metric.volatilityDirection) ? 'volatilityRising' : 'volatilityFalling'
  }

  return 'middleRising'
}

/**
 * 计算"立即关注"组的推荐分数。
 * 综合考虑：异常下滑、低分次数、下滑幅度、临界状态、多标签叠加等因素。
 */
export const getAttentionRecommendScore = (
  metric: StudentMetricType,
  config: HomeDashboardConfigType
): number => {
  const weights = config.recommendation.attentionWeights
  let score = 0

  if (metric.matchedTags.some((tag) => tag.key === 'abnormal')) {
    score += Math.max(0, metric.latestDelta * -1) * (weights.abnormalDrop || 0)
  }

  if (metric.matchedTags.some((tag) => tag.key === 'persistentLowScore')) {
    score += metric.recentThreeScores.filter((item) => item < config.tagRules.passLine).length * (weights.lowScoreHit || 0) * 10
  }

  if (metric.matchedTags.some((tag) => tag.key === 'declining')) {
    score += Math.max(metric.latestDrop, Math.max(0, metric.recentThreeScores[0] - metric.recentThreeScores.slice(-1)[0])) * (weights.declineDelta || 0)
  }

  if (metric.matchedTags.some((tag) => tag.key === 'critical') && metric.latestScore !== null) {
    score += Math.max(0, config.tagRules.passLine - metric.latestScore)
  }

  score += Math.max(0, metric.matchedTags.filter((tag) => tag.group === 'attention').length - 1) * (weights.multiTagBonus || 0) * 10

  return Number(score.toFixed(2))
}

/**
 * 计算"值得鼓励"组的推荐分数。
 * 综合考虑：上升幅度、低位回升、明显进步、稳定前列等因素。
 */
export const getEncouragementRecommendScore = (
  metric: StudentMetricType,
  config: HomeDashboardConfigType
): number => {
  const weights = config.recommendation.encouragementWeights
  const recentRise =
    metric.recentThreeScores.length >= 2
      ? Math.max(0, metric.recentThreeScores[metric.recentThreeScores.length - 1] - metric.recentThreeScores[0])
      : 0
  let score = recentRise * (weights.riseDelta || 0)

  if (metric.matchedTags.some((tag) => tag.key === 'lowRecovery')) {
    score += (weights.recoveryBonus || 0) * 12
  }

  if (metric.matchedTags.some((tag) => tag.key === 'improving')) {
    score += Math.max(0, metric.latestDelta) * 1.5
  }

  if (metric.matchedTags.some((tag) => tag.key === 'stableTop')) {
    score += metric.stableTopRecentCount * (weights.stableTopBonus || 0) * 8
  }

  return Number(score.toFixed(2))
}

/**
 * 计算"中段变化"组的推荐分数。
 * 综合考虑：中段下滑幅度、波动程度、中段上升等因素。
 */
export const getMiddleChangeRecommendScore = (
  metric: StudentMetricType,
  config: HomeDashboardConfigType
): number => {
  const weights = config.recommendation.middleChangeWeights
  const recentChange =
    metric.recentThreeScores.length >= 2
      ? metric.recentThreeScores[metric.recentThreeScores.length - 1] - metric.recentThreeScores[0]
      : 0
  let score = 0

  if (metric.matchedTags.some((tag) => tag.key === 'middleFalling')) {
    score += Math.max(0, recentChange * -1) * (weights.fallingDelta || 0)
  }

  if (metric.matchedTags.some((tag) => tag.key === 'volatility')) {
    score += metric.recentStdDev * (weights.volatility || 0)
  }

  if (metric.matchedTags.some((tag) => tag.key === 'middleRising')) {
    score += Math.max(0, recentChange) * (weights.risingDelta || 0)
  }

  return Number(score.toFixed(2))
}

/**
 * 计算"波动观察"组的推荐分数。
 * 主要考量波动程度和波动方向：下行波动权重更高。
 */
export const getVolatilityWatchRecommendScore = (
  metric: StudentMetricType,
  config: HomeDashboardConfigType
): number => {
  const weights = config.recommendation.middleChangeWeights
  let score = 0

  if (metric.matchedTags.some((tag) => tag.key === 'volatility')) {
    score += metric.recentStdDev * (weights.volatility || 0)
    score += isDownwardDirection(metric.volatilityDirection) ? 12 : 6
  }

  return Number(score.toFixed(2))
}

/**
 * 推荐分数计算入口。
 * 根据分组类型分发到对应的计算函数。
 */
export const getRecommendScore = (
  metric: StudentMetricType,
  groupKey: DashboardFocusGroupKeyType,
  config: HomeDashboardConfigType
): number => {
  switch (groupKey) {
    case 'attention':
      return getAttentionRecommendScore(metric, config)
    case 'encouragement':
      return getEncouragementRecommendScore(metric, config)
    case 'middleChange':
      return getMiddleChangeRecommendScore(metric, config)
    case 'volatilityWatch':
      return getVolatilityWatchRecommendScore(metric, config)
    default:
      return 0
  }
}
