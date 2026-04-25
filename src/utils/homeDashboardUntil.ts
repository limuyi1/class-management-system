import { NAME_PROP } from '@/types/Constants'
import type {
  DashboardAlertGroupType,
  DashboardDataType,
  DashboardEvaluationOverviewType,
  DashboardKpiType,
  DashboardRankingGroupType,
  DashboardStudentListItemType,
  DashboardStudentOptionType,
  DashboardStudentTrendType,
  DashboardUnitOverviewType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

interface StudentMetricType {
  name: string
  student: StudentDataType
  points: Array<{ prop: string; label: string; score: number }>
  averageScore: number
  lowScoreCount: number
  highestScore: number
  lowestScore: number
  scoreRange: number
  latestScore: number | null
  previousScore: number | null
  historyAverage: number | null
  latestDelta: number
  latestDrop: number
  trendDelta: number
  stableTopCount: number
}

interface BuildDashboardDataOptions {
  students: StudentDataType[]
  unitHeaders: SettingType[]
  selectedStudentNames: string[]
  aiConfigured: boolean
  config: HomeDashboardConfigType
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

const buildUnitOverview = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  config: HomeDashboardConfigType
): DashboardUnitOverviewType[] => {
  return unitHeaders.map((header) => {
    const scores = students
      .map((student) => getNumericScore(student, header.prop))
      .filter((score): score is number => score !== null)

    return {
      prop: header.prop,
      label: header.label,
      averageScore: Number(averageOf(scores).toFixed(2)),
      validCount: scores.length,
      scoreBands: config.unitOverview.scoreBands.map((band) => ({
        ...band,
        count: scores.filter((score) => score >= band.min && score <= band.max).length
      }))
    }
  })
}

const buildStableTopCountMap = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  topN: number
) => {
  const counts = new Map<string, number>()

  unitHeaders.forEach((header) => {
    const rankedStudents = students
      .map((student) => ({
        name: getStudentName(student),
        score: getNumericScore(student, header.prop)
      }))
      .filter((item): item is { name: string; score: number } => item.score !== null)
      .sort((a, b) => b.score - a.score)

    rankedStudents.slice(0, topN).forEach((item) => {
      counts.set(item.name, (counts.get(item.name) || 0) + 1)
    })
  })

  return counts
}

const buildStudentMetrics = (
  students: StudentDataType[],
  unitHeaders: SettingType[],
  config: HomeDashboardConfigType
): StudentMetricType[] => {
  const stableTopCountMap = buildStableTopCountMap(
    students,
    unitHeaders,
    config.rankings.stableTopRankLimit
  )

  return students
    .map((student) => {
      const points = unitHeaders
        .map((header) => ({
          prop: header.prop,
          label: header.label,
          score: getNumericScore(student, header.prop)
        }))
        .filter(
          (item): item is { prop: string; label: string; score: number } => item.score !== null
        )

      if (!points.length) return null

      const scores = points.map((point) => point.score)
      const halfIndex = Math.ceil(scores.length / 2)
      const frontHalf = scores.slice(0, halfIndex)
      const backHalf = scores.slice(halfIndex)
      const latestScore = scores.length ? scores[scores.length - 1] : null
      const previousScore = scores.length >= 2 ? scores[scores.length - 2] : null
      const historyScores = scores.slice(0, -1)
      const highestScore = Math.max(...scores)
      const lowestScore = Math.min(...scores)

      return {
        name: getStudentName(student),
        student,
        points,
        averageScore: Number(averageOf(scores).toFixed(2)),
        lowScoreCount: scores.filter((score) => score < config.alerts.lowScoreLine).length,
        highestScore,
        lowestScore,
        scoreRange: highestScore - lowestScore,
        latestScore,
        previousScore,
        historyAverage: historyScores.length ? Number(averageOf(historyScores).toFixed(2)) : null,
        latestDelta:
          latestScore !== null && historyScores.length
            ? Number((latestScore - averageOf(historyScores)).toFixed(2))
            : 0,
        latestDrop:
          latestScore !== null && previousScore !== null && latestScore < previousScore
            ? Number((previousScore - latestScore).toFixed(2))
            : 0,
        trendDelta:
          backHalf.length && frontHalf.length
            ? Number((averageOf(backHalf) - averageOf(frontHalf)).toFixed(2))
            : 0,
        stableTopCount: stableTopCountMap.get(getStudentName(student)) || 0
      }
    })
    .filter((item): item is StudentMetricType => item !== null)
}

const toStudentListItem = (
  metric: StudentMetricType,
  subtitle: string,
  badge: string
): DashboardStudentListItemType => ({
  name: metric.name,
  subtitle,
  badge
})

const formatDeclineValue = (value: number): string => Math.abs(value).toFixed(1)

const MIN_UNITS_FOR_DISTINCT_STAGE_DECLINE = 4

const getDeclineSeverity = (metric: StudentMetricType, config: HomeDashboardConfigType): number => {
  const values: number[] = []

  if (
    metric.historyAverage !== null &&
    metric.latestDelta <= -config.alerts.declineMinDrop &&
    metric.latestDrop > 0
  ) {
    values.push(metric.latestDrop)
  }

  if (
    metric.points.length >= MIN_UNITS_FOR_DISTINCT_STAGE_DECLINE &&
    metric.trendDelta <= -config.alerts.declineMinDrop
  ) {
    values.push(Math.abs(metric.trendDelta))
  }

  return values.length ? Math.max(...values) : 0
}

const buildAlertGroups = (
  metrics: StudentMetricType[],
  config: HomeDashboardConfigType
): DashboardAlertGroupType[] => {
  /**
   * 首页预警优先保证解释性：
   * 规则尽量直接映射成老师能理解的自然语言，而不是隐藏在复杂统计指标里
   */
  const persistentLowScore = metrics
    .filter((metric) => metric.lowScoreCount >= config.alerts.persistentLowScoreMinCount)
    .sort((a, b) => {
      const aLatestLowScore = a.latestScore !== null && a.latestScore < config.alerts.lowScoreLine
      const bLatestLowScore = b.latestScore !== null && b.latestScore < config.alerts.lowScoreLine

      if (aLatestLowScore !== bLatestLowScore) return bLatestLowScore ? 1 : -1
      if (b.lowScoreCount !== a.lowScoreCount) return b.lowScoreCount - a.lowScoreCount
      return a.averageScore - b.averageScore
    })
    .map((metric) =>
      toStudentListItem(
        metric,
        `${metric.lowScoreCount} 个单元低于 ${config.alerts.lowScoreLine} 分，均分 ${metric.averageScore.toFixed(1)}`,
        `最近 ${metric.latestScore ?? '--'} 分`
      )
    )

  const largestFluctuation = metrics
    .filter(
      (metric) =>
        metric.points.length >= config.alerts.maxFluctuationMinUnits &&
        metric.scoreRange >= config.alerts.maxFluctuationMinRange
    )
    .sort((a, b) => {
      const aLatestDeclining = a.latestDrop > 0
      const bLatestDeclining = b.latestDrop > 0
      const aBelowHistory = a.historyAverage !== null && a.latestDelta < 0
      const bBelowHistory = b.historyAverage !== null && b.latestDelta < 0

      if (aLatestDeclining !== bLatestDeclining) return bLatestDeclining ? 1 : -1
      if (aBelowHistory !== bBelowHistory) return bBelowHistory ? 1 : -1
      return b.scoreRange - a.scoreRange
    })
    .map((metric) =>
      toStudentListItem(
        metric,
        `最高 ${metric.highestScore} 分，最低 ${metric.lowestScore} 分`,
        `分差 ${metric.scoreRange} 分`
      )
    )

  const declining = metrics
    .filter((metric) => {
      const hasLatestDecline =
        metric.historyAverage !== null &&
        metric.latestDelta <= -config.alerts.declineMinDrop &&
        metric.latestDrop > 0
      const hasTrendDecline =
        metric.points.length >= MIN_UNITS_FOR_DISTINCT_STAGE_DECLINE &&
        metric.trendDelta <= -config.alerts.declineMinDrop

      return hasLatestDecline || hasTrendDecline
    })
    .sort((a, b) => getDeclineSeverity(b, config) - getDeclineSeverity(a, config))
    .map((metric) => {
      const detailParts: string[] = []
      const declineValues: number[] = []

      if (
        metric.historyAverage !== null &&
        metric.latestDelta <= -config.alerts.declineMinDrop &&
        metric.latestDrop > 0
      ) {
        detailParts.push(`最近较上次下滑：${formatDeclineValue(metric.latestDrop)} 分`)

        if (metric.latestDrop > 0) {
          declineValues.push(metric.latestDrop)
        }
      }

      if (
        metric.points.length >= MIN_UNITS_FOR_DISTINCT_STAGE_DECLINE &&
        metric.trendDelta <= -config.alerts.declineMinDrop
      ) {
        detailParts.push(`后半程低于前半程：${formatDeclineValue(metric.trendDelta)} 分`)
        declineValues.push(Math.abs(metric.trendDelta))
      }

      const maxDecline = Math.max(...declineValues)

      return toStudentListItem(metric, detailParts.join('\n'), `下滑 ${maxDecline.toFixed(1)} 分`)
    })

  return [
    { key: 'persistentLowScore', label: '持续低分', items: persistentLowScore },
    { key: 'largestFluctuation', label: '波动最大', items: largestFluctuation },
    { key: 'declining', label: '下滑关注', items: declining }
  ]
}

const buildRankingGroups = (
  metrics: StudentMetricType[],
  config: HomeDashboardConfigType
): DashboardRankingGroupType[] => {
  const rankingLimit = Math.max(config.rankings.displayCount, config.rankings.compactDisplayCount)

  /**
   * 榜单和预警的职责不同：
   * 榜单强调“变化排序”，预警强调“需要优先关注”
   */
  const mostImproved = metrics
    .filter(
      (metric) => metric.points.length >= config.rankings.minUnitsForTrend && metric.trendDelta > 0
    )
    .sort((a, b) => b.trendDelta - a.trendDelta)
    .slice(0, rankingLimit)
    .map((metric) =>
      toStudentListItem(
        metric,
        `后半程较前半程提升 ${metric.trendDelta.toFixed(1)} 分`,
        `均分 ${metric.averageScore.toFixed(1)}`
      )
    )

  const stableTopFive = metrics
    .filter((metric) => metric.stableTopCount > 0)
    .sort((a, b) => {
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore
      return b.stableTopCount - a.stableTopCount
    })
    .slice(0, rankingLimit)
    .map((metric) =>
      toStudentListItem(
        metric,
        `进入班级前五 共 ${metric.stableTopCount} 次`,
        `均分 ${metric.averageScore.toFixed(1)}`
      )
    )

  return [
    { key: 'stableTopFive', label: '高分稳定', items: stableTopFive },
    { key: 'mostImproved', label: '进步最大', items: mostImproved }
  ]
}

const buildStudentTrend = (
  metrics: StudentMetricType[],
  selectedStudentNames: string[],
  config: HomeDashboardConfigType
): DashboardStudentTrendType | null => {
  const selectedMetrics = selectedStudentNames
    .map((name) => metrics.find((item) => item.name === name))
    .filter((item): item is StudentMetricType => item !== undefined)

  if (!selectedMetrics.length) return null

  const summaries: string[] = []

  /**
   * 单人模式和多人对比模式使用不同摘要，避免把单人结论硬套到多人图上
   */
  if (selectedMetrics.length === 1) {
    const metric = selectedMetrics[0]

    if (metric.latestDelta <= -config.studentTrend.significantDrop) {
      summaries.push(
        `近期成绩下降明显，最近一次较历史均分低 ${Math.abs(metric.latestDelta).toFixed(1)} 分`
      )
    } else if (metric.latestDelta >= config.studentTrend.significantRise) {
      summaries.push(`近期成绩回升明显，最近一次较历史均分高 ${metric.latestDelta.toFixed(1)} 分`)
    } else if (metric.scoreRange >= config.studentTrend.highFluctuationRange) {
      summaries.push(`整体波动较大，最高与最低相差 ${metric.scoreRange} 分`)
    } else {
      summaries.push('整体表现相对平稳，最近几个单元没有出现明显异动')
    }

    if (metric.lowScoreCount > 0) {
      summaries.push(
        `共有 ${metric.lowScoreCount} 个单元低于 ${config.studentTrend.lowScoreLine} 分`
      )
    } else {
      summaries.push(`所有已录入单元均高于 ${config.studentTrend.lowScoreLine} 分`)
    }

    summaries.push(
      `当前已录入 ${metric.points.length} 个单元，均分 ${metric.averageScore.toFixed(1)} 分`
    )
  } else {
    const highestAverage = [...selectedMetrics].sort((a, b) => b.averageScore - a.averageScore)[0]
    const largestFluctuation = [...selectedMetrics].sort((a, b) => b.scoreRange - a.scoreRange)[0]
    const latestBest = [...selectedMetrics]
      .filter((metric) => metric.latestScore !== null)
      .sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0))[0]

    summaries.push(`当前对比 ${selectedMetrics.length} 名学生，均分最高的是 ${highestAverage.name}`)
    summaries.push(
      `波动最大的是 ${largestFluctuation.name}，分差 ${largestFluctuation.scoreRange} 分`
    )

    if (latestBest) {
      summaries.push(`最近一次成绩最高的是 ${latestBest.name}，为 ${latestBest.latestScore} 分`)
    }
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
  unitOverview: DashboardUnitOverviewType[],
  metrics: StudentMetricType[],
  alertGroups: DashboardAlertGroupType[],
  config: HomeDashboardConfigType
): DashboardKpiType => {
  const allScores = metrics.flatMap((metric) => metric.points.map((point) => point.score))
  const averageScore = averageOf(allScores)
  const passRates = unitOverview.map((unit) => {
    const passedCount = unit.scoreBands
      .filter((band) => band.min >= config.alerts.lowScoreLine)
      .reduce((sum, band) => sum + band.count, 0)

    return unit.validCount ? (passedCount / unit.validCount) * 100 : 0
  })
  const attentionStudentCount = new Set(
    alertGroups.flatMap((group) => group.items).map((item) => item.name)
  ).size
  const unitWithLargestAverageRange = [...unitOverview].sort(
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
    completedUnitCount: unitOverview.length,
    biggestFluctuationUnitLabel,
    diagnosticText: `本学期已完成 ${unitOverview.length} 个单元，重点关注学生共 ${attentionStudentCount} 人，${biggestFluctuationUnitLabel === '--' ? '暂无明显波动单元' : `${biggestFluctuationUnitLabel} 波动最大`}`
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
  const unitOverview = buildUnitOverview(students, unitHeaders, config).filter(
    (item) => item.validCount > 0
  )
  const metrics = buildStudentMetrics(students, unitHeaders, config)
  const alertGroups = buildAlertGroups(metrics, config)
  const rankingGroups = buildRankingGroups(metrics, config)
  const quickStudentNames = Array.from(
    new Set(
      [...alertGroups, ...rankingGroups]
        .flatMap((group) => group.items)
        .map((item) => item.name)
        .slice(0, 12)
    )
  )

  return {
    unitHeaders,
    unitOverview,
    kpi: buildDashboardKpi(unitOverview, metrics, alertGroups, config),
    alertGroups,
    rankingGroups,
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
