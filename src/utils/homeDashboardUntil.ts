import { NAME_PROP } from '@/types/Constants'
import type {
  DashboardDataType,
  DashboardEvaluationOverviewType,
  DashboardFocusGroupKeyType,
  DashboardFocusGroupType,
  DashboardFocusSectionKeyType,
  DashboardFocusSectionType,
  DashboardKeyStudentListType,
  DashboardKpiType,
  DashboardStudentListItemType,
  DashboardStudentOptionType,
  DashboardStudentTagType,
  DashboardStudentTrendType,
  DashboardSummaryCardType,
  DashboardTagKeyType,
  DashboardTeachingInsightType,
  DashboardUnitOverviewType,
  DashboardVolatilityDirectionType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

interface BuildDashboardDataOptions {
  students: StudentDataType[]
  unitHeaders: SettingType[]
  selectedStudentNames: string[]
  aiConfigured: boolean
  config: HomeDashboardConfigType
}

interface UnitMetricType extends DashboardUnitOverviewType {
  scores: number[]
  lowScoreCount: number
  standardDeviation: number
}

interface StudentMetricType {
  name: string
  student: StudentDataType
  points: Array<{ prop: string; label: string; score: number; rank: number | null }>
  averageScore: number
  latestScore: number | null
  previousScore: number | null
  historyAverage: number | null
  latestDelta: number
  latestDrop: number
  scoreRange: number
  lowScoreCount: number
  stableTopRecentCount: number
  recentScores: number[]
  recentThreeScores: number[]
  recentFourScores: number[]
  recentAverage: number | null
  recentStdDev: number
  volatilityDirection: DashboardVolatilityDirectionType | null
  matchedTags: DashboardStudentTagType[]
}

const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '未命名' : String(name)
}

const getNumericScore = (student: StudentDataType, prop: string): number | null => {
  const value = student[prop]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const averageOf = (scores: number[]): number =>
  scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0

const standardDeviationOf = (scores: number[]): number => {
  if (!scores.length) return 0
  const average = averageOf(scores)
  const variance = averageOf(scores.map((score) => (score - average) ** 2))

  return Math.sqrt(variance)
}

const formatScore = (score: number): string => Number(score.toFixed(1)).toString()

const formatTrendText = (scores: number[]): string => {
  if (!scores.length) return '--'

  return scores.map((score) => formatScore(score)).join(' → ')
}

const getScoreDiffText = (value: number): string => Number(Math.abs(value).toFixed(1)).toString()

const getRecentValues = <T>(values: T[], windowSize: number): T[] => {
  if (windowSize <= 0) return values
  return values.slice(-windowSize)
}

const isStrictlyAscending = (scores: number[]): boolean => {
  if (scores.length < 2) return false

  return scores.every((score, index) => index === 0 || score > scores[index - 1])
}

const isStrictlyDescending = (scores: number[]): boolean => {
  if (scores.length < 2) return false

  return scores.every((score, index) => index === 0 || score < scores[index - 1])
}

const buildUnitMetrics = (
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

const buildRankMapByUnit = (students: StudentDataType[], unitHeaders: SettingType[]) => {
  return unitHeaders.map((header) => {
    const rankMap = new Map<string, number>()
    const rankedStudents = students
      .map((student) => ({
        name: getStudentName(student),
        score: getNumericScore(student, header.prop)
      }))
      .filter((item): item is { name: string; score: number } => item.score !== null)
      .sort((a, b) => b.score - a.score)

    rankedStudents.forEach((item, index) => {
      rankMap.set(item.name, index + 1)
    })

    return {
      prop: header.prop,
      rankMap
    }
  })
}

const createTag = (
  key: DashboardTagKeyType,
  config: HomeDashboardConfigType
): DashboardStudentTagType => {
  const tagConfig = config.tagRules.tags[key]
  const groupConfig = config.tagRules.tagGroups[tagConfig.group]

  return {
    key,
    label: tagConfig.label,
    priority: tagConfig.priority,
    group: tagConfig.group,
    tone: groupConfig.tone,
    description: tagConfig.description
  }
}

const getRecentChange = (scores: number[]): number => {
  if (scores.length < 2) return 0

  return scores[scores.length - 1] - scores[0]
}

const getVolatilityDirection = (scores: number[]): DashboardVolatilityDirectionType | null => {
  if (!scores.length) return null

  const recentChange = getRecentChange(scores)
  if (recentChange > 0) return 'up'
  if (recentChange < 0) return 'down'

  const average = averageOf(scores)
  const latestScore = scores[scores.length - 1]

  if (latestScore > average) return 'up'
  if (latestScore < average) return 'down'

  return null
}

const scoresToHitCount = (scores: number[], passLine: number): number =>
  scores.filter((score) => score < passLine).length

const getTagSortScore = (
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

const buildReasonText = (
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
      return `前期出现低分后，最近阶段开始回升，提升趋势已出现`
    case 'improving':
      return `最近 3 次累计提升 ${formatScore(Math.max(0, metric.recentThreeScores.slice(-1)[0] - metric.recentThreeScores[0]))} 分，进步明显`
    case 'middleFalling':
      return `当前仍处中段，但最近阶段持续下降，需要提前干预`
    case 'middleRising':
      return `当前仍处中段，但最近阶段稳步上升，值得继续观察`
    case 'volatility':
      return metric.volatilityDirection === 'up'
        ? `最近几次起伏较大，整体偏上行波动`
        : `最近几次起伏较大，整体偏下行波动`
    case 'stableTop':
      return `最近 3 次中有 ${metric.stableTopRecentCount} 次进入班级前五，表现稳定`
    default:
      return primaryTag.description
  }
}

const getAttentionRecommendScore = (metric: StudentMetricType, config: HomeDashboardConfigType): number => {
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

const getEncouragementRecommendScore = (
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

const getMiddleChangeRecommendScore = (
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

const getVolatilityWatchRecommendScore = (
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

const buildStudentMetrics = (
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
          }
        })
        .filter(
          (item): item is { prop: string; label: string; score: number; rank: number | null } =>
            item !== null
        )

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

      const matchedTags: DashboardStudentTagType[] = []
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

      const uniqueTags = matchedTags
        .filter(
          (tag, index, array) => array.findIndex((current) => current.key === tag.key) === index
        )
        .sort((a, b) => a.priority - b.priority)

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
        matchedTags: uniqueTags
      }
    })
    .filter((item): item is StudentMetricType => item !== null)
}

const toStudentListItem = (
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
  const recentScores = metric.recentThreeScores

  return {
    name: metric.name,
    trendText: formatTrendText(recentScores),
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

const getSectionLabel = (
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

const getMiddleChangeDisplayKey = (metric: StudentMetricType): DashboardFocusSectionKeyType => {
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

const buildFocusGroups = (
  metrics: StudentMetricType[],
  config: HomeDashboardConfigType
): DashboardFocusGroupType[] => {
  const tagGroups = config.tagRules.tagGroups
  const enabledTags = Object.entries(config.tagRules.tags)
    .filter(([, tagConfig]) => tagConfig.enabled)
    .map(([key, tagConfig]) => ({
      key: key as DashboardTagKeyType,
      ...tagConfig
    }))
    .sort((a, b) => a.priority - b.priority)

  const sectionsByGroup = enabledTags.reduce<Record<DashboardFocusGroupKeyType, DashboardFocusSectionType[]>>(
    (result, tag) => {
      const sectionMap = new Map<
        DashboardFocusSectionKeyType,
        { label: string; description: string; entries: Array<{ item: DashboardStudentListItemType; tagSortScore: number }> }
      >()

      metrics
        .filter((metric) => metric.matchedTags.some((matchedTag) => matchedTag.key === tag.key))
        .forEach((metric) => {
          const item = toStudentListItem(metric, tag.key)
          if (!item) return

          const sectionMeta =
            tag.key === 'volatility'
              ? getSectionLabel(tag.key, metric)
              : {
                  key: tag.key,
                  label: tag.label,
                  description: tag.description
                }
          const currentSection = sectionMap.get(sectionMeta.key) || {
            label: sectionMeta.label,
            description: sectionMeta.description,
            entries: []
          }

          currentSection.entries.push({
            item,
            tagSortScore: getTagSortScore(metric, tag.key, config)
          })
          sectionMap.set(sectionMeta.key, currentSection)
        })

      sectionMap.forEach((section, sectionKey) => {
        const items = section.entries
          .sort((a, b) => {
            if (a.tagSortScore !== b.tagSortScore) {
              return b.tagSortScore - a.tagSortScore
            }

            if (a.item.primaryTag.key === tag.key && b.item.primaryTag.key !== tag.key) {
              return -1
            }

            if (a.item.primaryTag.key !== tag.key && b.item.primaryTag.key === tag.key) {
              return 1
            }

            if (a.item.primaryTag.priority !== b.item.primaryTag.priority) {
              return a.item.primaryTag.priority - b.item.primaryTag.priority
            }

            return a.item.name.localeCompare(b.item.name, 'zh-CN')
          })
          .map((entry) => entry.item)

        result[tag.group].push({
          key: sectionKey,
          label: section.label,
          description: section.description,
          count: items.length,
          items
        })
      })

      return result
    },
    {
      attention: [],
      encouragement: [],
      middleChange: [],
      volatilityWatch: []
    }
  )

  return (Object.keys(tagGroups) as DashboardFocusGroupKeyType[]).map((groupKey) => ({
    key: groupKey,
    label: tagGroups[groupKey].label,
    tone: tagGroups[groupKey].tone,
    sections: sectionsByGroup[groupKey].filter((section) => section.items.length > 0)
  }))
}

const buildSummaryCards = (
  metrics: StudentMetricType[],
  kpi: DashboardKpiType,
  config: HomeDashboardConfigType
): DashboardSummaryCardType[] => {
  const groupStudents = (groupKey: DashboardFocusGroupKeyType) =>
    metrics.filter((metric) => metric.matchedTags.some((tag) => tag.group === groupKey))

  const buildCardDetails = (groupKey: DashboardFocusGroupKeyType) => {
    return Object.entries(config.tagRules.tags)
      .filter(([, tagConfig]) => tagConfig.enabled && tagConfig.group === groupKey)
      .map(([key, tagConfig]) => ({
        label: tagConfig.label,
        value: metrics.filter((metric) => metric.matchedTags.some((tag) => tag.key === key)).length
      }))
      .filter((item) => Number(item.value) > 0)
  }

  return [
    {
      key: 'attention',
      label: config.tagRules.tagGroups.attention.label,
      value: groupStudents('attention').length,
      unit: '人',
      icon: 'circle-exclamation',
      layout: 'quad',
      tone: config.tagRules.tagGroups.attention.tone,
      summary: '优先锁定需要谈话、辅导和跟进的学生',
      details: buildCardDetails('attention')
    },
    {
      key: 'encouragement',
      label: config.tagRules.tagGroups.encouragement.label,
      value: groupStudents('encouragement').length,
      unit: '人',
      icon: 'thumbs-up',
      layout: 'double',
      tone: config.tagRules.tagGroups.encouragement.tone,
      summary: '及时表扬正在变好、表现稳定的学生',
      details: buildCardDetails('encouragement').filter((item) => item.label !== '高分稳定')
    },
    {
      key: 'middleChange',
      label: config.tagRules.tagGroups.middleChange.label,
      value: groupStudents('middleChange').length,
      unit: '人',
      icon: 'chart-line',
      layout: 'triple',
      tone: config.tagRules.tagGroups.middleChange.tone,
      summary: '看见最容易被忽视但正在变化的学生',
      details: buildCardDetails('middleChange')
    },
    {
      key: 'volatilityWatch',
      label: config.tagRules.tagGroups.volatilityWatch.label,
      value: groupStudents('volatilityWatch').length,
      unit: '人',
      icon: 'wave-square',
      layout: 'double',
      tone: config.tagRules.tagGroups.volatilityWatch.tone,
      summary: '单独观察波动较大的学生，分清上行和下行趋势',
      details: [
        {
          label: '波动下行',
          value: metrics.filter(
            (metric) =>
              metric.matchedTags.some((tag) => tag.key === 'volatility') &&
              metric.volatilityDirection === 'down'
          ).length
        },
        {
          label: '波动上行',
          value: metrics.filter(
            (metric) =>
              metric.matchedTags.some((tag) => tag.key === 'volatility') &&
              metric.volatilityDirection === 'up'
          ).length
        }
      ].filter((item) => Number(item.value) > 0)
    },
    {
      key: 'overview',
      label: '班级概况',
      value: `${kpi.averageScore}`,
      unit: '分',
      icon: 'clock',
      layout: 'overview',
      tone: 'warning',
      summary: '保留整体背景，辅助判断单元节奏和班级水平',
      details: [
        { label: '班均分', value: `${kpi.averageScore} 分` },
        { label: '及格率', value: `${kpi.averagePassRate}%` },
        { label: '已完成单元数', value: `${kpi.completedUnitCount} / ${kpi.totalUnitCount}` }
      ]
    }
  ]
}

const buildKeyStudentLists = (
  metrics: StudentMetricType[],
  config: HomeDashboardConfigType
): DashboardKeyStudentListType[] => {
  const labels: Record<DashboardFocusGroupKeyType, { label: string; description: string }> = {
    attention: {
      label: '需要马上关注',
      description: '优先安排谈话、补救和错题复盘'
    },
    encouragement: {
      label: '最近值得鼓励',
      description: '适合表扬、强化评语和课堂反馈'
    },
    middleChange: {
      label: '波动观察',
      description: '重点盯住波动下行，也看见正在上行的波动学生'
    },
    volatilityWatch: {
      label: '波动观察',
      description: '重点盯住波动下行，也看见正在上行的波动学生'
    }
  }

  const getRecommendScore = (metric: StudentMetricType, groupKey: DashboardFocusGroupKeyType) => {
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

  const middleChangeOrder: Record<DashboardFocusSectionKeyType, number> = {
    middleFalling: 0,
    middleRising: 1,
    volatilityFalling: 2,
    volatilityRising: 3,
    volatility: 4,
    critical: 5,
    persistentLowScore: 6,
    declining: 7,
    abnormal: 8,
    improving: 9,
    lowRecovery: 10,
    stableTop: 11
  }

  return (['attention', 'encouragement', 'volatilityWatch'] as DashboardFocusGroupKeyType[]).map(
    (groupKey) => ({
    key: groupKey,
    label: labels[groupKey].label,
    description: labels[groupKey].description,
    items: metrics
      .filter((metric) => metric.matchedTags.some((tag) => tag.group === groupKey))
      .map((metric) => ({
        metric,
        item: toStudentListItem(metric),
        recommendScore: getRecommendScore(metric, groupKey)
      }))
      .filter(
        (
          entry
        ): entry is {
          metric: StudentMetricType
          item: DashboardStudentListItemType
          recommendScore: number
        } =>
          entry.item !== null
      )
      .sort((a, b) => {
        if (a.recommendScore !== b.recommendScore) {
          return b.recommendScore - a.recommendScore
        }

        if (groupKey === 'volatilityWatch') {
          const sectionOrderDiff =
            middleChangeOrder[getMiddleChangeDisplayKey(a.metric)] -
            middleChangeOrder[getMiddleChangeDisplayKey(b.metric)]

          if (sectionOrderDiff !== 0) {
            return sectionOrderDiff
          }
        }

        if (a.item.primaryTag.priority !== b.item.primaryTag.priority) {
          return a.item.primaryTag.priority - b.item.primaryTag.priority
        }

        return a.item.name.localeCompare(b.item.name, 'zh-CN')
      })
      .slice(0, config.recommendation.maxItemsPerGroup)
      .map((entry) => entry.item)
    })
  )
}

const buildTeachingInsights = (unitMetrics: UnitMetricType[]): DashboardTeachingInsightType[] => {
  if (!unitMetrics.length) return []

  const lowestAverage = [...unitMetrics].sort((a, b) => a.averageScore - b.averageScore)[0]
  const mostLowScores = [...unitMetrics].sort((a, b) => b.lowScoreCount - a.lowScoreCount)[0]
  const largestGap = [...unitMetrics].sort((a, b) => b.standardDeviation - a.standardDeviation)[0]
  const mostVolatile =
    unitMetrics
      .slice(1)
      .map((unit, index) => ({
        unit,
        delta: Math.abs(unit.averageScore - unitMetrics[index].averageScore)
      }))
      .sort((a, b) => b.delta - a.delta)[0]?.unit || unitMetrics[0]

  return [
    {
      key: 'lowestAverage',
      label: '班均最低',
      value: lowestAverage.label
    },
    {
      key: 'mostLowScores',
      label: '低分人数最多',
      value: mostLowScores.label
    },
    {
      key: 'largestGap',
      label: '差异最大',
      value: largestGap.label
    },
    {
      key: 'mostVolatile',
      label: '波动最明显',
      value: mostVolatile.label
    }
  ]
}

const buildStudentTrend = (
  metrics: StudentMetricType[],
  selectedStudentNames: string[],
  config: HomeDashboardConfigType
): DashboardStudentTrendType | null => {
  const selectedMetrics = selectedStudentNames
    .map((name) => metrics.find((metric) => metric.name === name))
    .filter((item): item is StudentMetricType => item !== undefined)

  if (!selectedMetrics.length) return null

  const summaries: string[] = []

  if (selectedMetrics.length === 1) {
    const metric = selectedMetrics[0]

    if (metric.latestDelta <= -config.studentTrend.significantDrop) {
      summaries.push(
        `近期成绩下降明显，最近一次较历史均分低 ${Math.abs(metric.latestDelta).toFixed(1)} 分`
      )
    } else if (metric.latestDelta >= config.studentTrend.significantRise) {
      summaries.push(`近期成绩回升明显，最近一次较历史均分高 ${metric.latestDelta.toFixed(1)} 分`)
    } else if (metric.scoreRange >= config.studentTrend.highFluctuationRange) {
      summaries.push(`整体波动较大，最高与最低相差 ${metric.scoreRange.toFixed(1)} 分`)
    } else {
      summaries.push('整体表现相对平稳，最近几个单元没有出现明显异动')
    }

    if (metric.matchedTags.length) {
      summaries.push(`当前命中标签：${metric.matchedTags.map((tag) => tag.label).join('、')}`)
    }

    summaries.push(`当前已录入 ${metric.points.length} 个单元，均分 ${metric.averageScore.toFixed(1)} 分`)
  } else {
    const highestAverage = [...selectedMetrics].sort((a, b) => b.averageScore - a.averageScore)[0]
    const largestFluctuation = [...selectedMetrics].sort((a, b) => b.scoreRange - a.scoreRange)[0]

    summaries.push(`当前对比 ${selectedMetrics.length} 名学生，均分最高的是 ${highestAverage.name}`)
    summaries.push(
      `波动最大的是 ${largestFluctuation.name}，分差 ${largestFluctuation.scoreRange.toFixed(1)} 分`
    )
    summaries.push('可结合标签和折线走势判断近期是否需要辅导、鼓励或持续观察')
  }

  return {
    mode: selectedMetrics.length > 1 ? 'compare' : 'single',
    students: selectedMetrics.map((metric) => {
      const commentPreview =
        typeof metric.student.comment === 'string' && metric.student.comment.trim()
          ? metric.student.comment.trim()
          : ''

      return {
        name: metric.name,
        scoreCount: metric.points.length,
        completedComment: commentPreview.length > 0,
        commentPreview,
        tags: metric.matchedTags,
        trendPoints: metric.points.map((point) => ({
          label: point.label,
          score: point.score
        }))
      }
    }),
    summaries: summaries.slice(0, config.studentTrend.summaryLimit)
  }
}

const buildStudentOptions = (students: StudentDataType[]): DashboardStudentOptionType[] => {
  return students
    .map((student) => getStudentName(student))
    .filter((name, index, array) => array.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .map((name) => ({
      label: name,
      value: name
    }))
}

const buildEvaluationOverview = (
  students: StudentDataType[],
  aiConfigured: boolean
): DashboardEvaluationOverviewType => {
  const completedCount = students.filter(
    (student) => typeof student.comment === 'string' && student.comment.trim().length > 0
  ).length
  const totalCount = students.length
  const pendingCount = Math.max(0, totalCount - completedCount)

  return {
    totalCount,
    completedCount,
    pendingCount,
    completionRate: totalCount ? Number(((completedCount / totalCount) * 100).toFixed(1)) : 0,
    aiConfigured
  }
}

const buildDashboardKpi = (
  unitMetrics: UnitMetricType[],
  metrics: StudentMetricType[],
  config: HomeDashboardConfigType,
  totalUnitCount: number
): DashboardKpiType => {
  const allScores = metrics.flatMap((metric) => metric.points.map((point) => point.score))
  const averageScore = averageOf(allScores)
  const passRates = unitMetrics.map((unit) => {
    const passedCount = unit.scoreBands
      .filter((band) => band.min >= config.tagRules.passLine)
      .reduce((sum, band) => sum + band.count, 0)

    return unit.validCount ? (passedCount / unit.validCount) * 100 : 0
  })
  const attentionStudentCount = metrics.filter((metric) =>
    metric.matchedTags.some((tag) => tag.group === 'attention')
  ).length
  const unitWithLargestAverageRange = [...unitMetrics].sort(
    (a, b) => Math.abs(b.averageScore - averageScore) - Math.abs(a.averageScore - averageScore)
  )[0]
  const averagePassRate = averageOf(passRates)
  const passRateFluctuation = passRates.length ? Math.max(...passRates) - Math.min(...passRates) : 0
  const biggestFluctuationUnitLabel = unitWithLargestAverageRange?.label || '--'

  return {
    averageScore: Number(averageScore.toFixed(1)),
    averagePassRate: Number(averagePassRate.toFixed(1)),
    passRateFluctuation: Number(passRateFluctuation.toFixed(1)),
    attentionStudentCount,
    completedUnitCount: unitMetrics.length,
    totalUnitCount,
    biggestFluctuationUnitLabel,
    diagnosticText: `本学期已完成 ${unitMetrics.length} 个单元，立即关注学生 ${attentionStudentCount} 人，${biggestFluctuationUnitLabel === '--' ? '暂无明显波动单元' : `${biggestFluctuationUnitLabel} 班级变化最明显`}`
  }
}

export const buildHomeDashboardData = (options: BuildDashboardDataOptions): DashboardDataType => {
  const {
    students,
    unitHeaders,
    selectedStudentNames = [],
    aiConfigured,
    config
  } = options as BuildDashboardDataOptions & { selectedStudentNames?: string[] }
  const unitMetrics = buildUnitMetrics(students, unitHeaders, config)
  const metrics = buildStudentMetrics(students, unitHeaders, config)
  const kpi = buildDashboardKpi(unitMetrics, metrics, config, unitHeaders.length)
  const focusGroups = buildFocusGroups(metrics, config)
  const keyStudentLists = buildKeyStudentLists(metrics, config)
  const quickStudentNames = Array.from(
    new Set(
      [...focusGroups.flatMap((group) => group.sections.flatMap((section) => section.items)), ...keyStudentLists.flatMap((list) => list.items)]
        .map((item) => item.name)
        .slice(0, 16)
    )
  )

  return {
    unitHeaders,
    unitOverview: unitMetrics.map(({ scores, lowScoreCount, standardDeviation, ...unit }) => unit),
    teachingInsights: buildTeachingInsights(unitMetrics),
    kpi,
    summaryCards: buildSummaryCards(metrics, kpi, config),
    focusGroups,
    keyStudentLists,
    studentOptions: buildStudentOptions(students),
    quickStudentNames,
    studentTrend: buildStudentTrend(
      metrics,
      selectedStudentNames.slice(0, config.studentTrend.maxCompareCount),
      config
    ),
    evaluationOverview: buildEvaluationOverview(students, aiConfigured)
  }
}
