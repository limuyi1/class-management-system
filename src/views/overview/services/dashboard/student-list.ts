import type {
  DashboardFocusSectionKeyType,
  DashboardFocusGroupKeyType,
  DashboardStudentListItemType,
  DashboardTagKeyType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'

import {
  formatScore,
  formatTrendText,
  getRecentChange,
  getScoreDiffText
} from '@/views/overview/services/dashboard/helpers'
import type { StudentMetricType } from '@/views/overview/services/dashboard/types'

const scoresToHitCount = (scores: number[], passLine: number): number =>
  scores.filter((score) => score < passLine).length

/**
 * 为同一标签内的学生排序，保证“最值得看的人”排在前面。
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
          (metric.volatilityDirection === 'down' ? 8 : metric.volatilityDirection === 'up' ? 4 : 0)
        ).toFixed(2)
      )
    case 'stableTop':
      return Number((metric.stableTopRecentCount * 20 + (metric.latestScore || 0)).toFixed(2))
    default:
      return 0
  }
}

/**
 * 给展示层生成可直接阅读的原因文案，避免组件关心业务条件。
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
      return metric.volatilityDirection === 'up'
        ? '最近几次起伏较大，整体偏上行波动'
        : '最近几次起伏较大，整体偏下行波动'
    case 'stableTop':
      return `最近 3 次中有 ${metric.stableTopRecentCount} 次进入班级前五，表现稳定`
    default:
      return primaryTag.description
  }
}

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

  if (metric?.volatilityDirection === 'up') {
    return {
      key: 'volatilityRising',
      label: '波动上行',
      description: '最近几次波动较大，但整体趋势偏上行'
    }
  }

  return {
    key: 'volatilityFalling',
    label: '波动下行',
    description: '最近几次波动较大，且整体趋势偏下行'
  }
}

export const getMiddleChangeDisplayKey = (metric: StudentMetricType): DashboardFocusSectionKeyType => {
  if (metric.matchedTags.some((tag) => tag.key === 'middleFalling')) {
    return 'middleFalling'
  }

  if (metric.matchedTags.some((tag) => tag.key === 'middleRising')) {
    return 'middleRising'
  }

  if (metric.matchedTags.some((tag) => tag.key === 'volatility')) {
    return metric.volatilityDirection === 'up' ? 'volatilityRising' : 'volatilityFalling'
  }

  return 'middleRising'
}

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

export const getVolatilityWatchRecommendScore = (
  metric: StudentMetricType,
  config: HomeDashboardConfigType
): number => {
  const weights = config.recommendation.middleChangeWeights
  let score = 0

  if (metric.matchedTags.some((tag) => tag.key === 'volatility')) {
    score += metric.recentStdDev * (weights.volatility || 0)
    score += metric.volatilityDirection === 'down' ? 12 : 6
  }

  return Number(score.toFixed(2))
}

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
