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
  DashboardStudentTrendType,
  DashboardSummaryCardType,
  DashboardTagKeyType,
  DashboardTeachingInsightType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'
import type { StudentDataType } from '@/types/StudentData'

import { averageOf, getStudentName } from '@/views/overview/services/dashboard/helpers'
import {
  getMiddleChangeDisplayKey,
  getRecommendScore,
  getSectionMeta,
  getTagSortScore,
  toStudentListItem
} from '@/views/overview/services/dashboard/student-list'
import type {
  BuildOverviewDashboardDataOptions,
  StudentMetricType,
  UnitMetricType
} from '@/views/overview/services/dashboard/types'

/**
 * 生成总览页右侧“学生观察站”的分组结构。
 */
export const buildFocusGroups = (
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
              ? getSectionMeta(tag.key, metric)
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

export const buildSummaryCards = (
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

export const buildKeyStudentLists = (
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
          recommendScore: getRecommendScore(metric, groupKey, config)
        }))
        .filter(
          (
            entry
          ): entry is {
            metric: StudentMetricType
            item: DashboardStudentListItemType
            recommendScore: number
          } => entry.item !== null
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

export const buildTeachingInsights = (unitMetrics: UnitMetricType[]): DashboardTeachingInsightType[] => {
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

export const buildStudentTrend = (
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

export const buildStudentOptions = (students: StudentDataType[]): DashboardStudentOptionType[] => {
  return students
    .map((student) => getStudentName(student))
    .filter((name, index, array) => array.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .map((name) => ({
      label: name,
      value: name
    }))
}

export const buildEvaluationOverview = (
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

export const buildDashboardKpi = (
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

export const buildOverviewDashboardData = (
  options: BuildOverviewDashboardDataOptions,
  unitMetrics: UnitMetricType[],
  metrics: StudentMetricType[]
): DashboardDataType => {
  const { students, unitHeaders, selectedStudentNames, aiConfigured, config } = options
  const kpi = buildDashboardKpi(unitMetrics, metrics, config, unitHeaders.length)
  const focusGroups = buildFocusGroups(metrics, config)
  const keyStudentLists = buildKeyStudentLists(metrics, config)
  const quickStudentNames = Array.from(
    new Set(
      [
        ...focusGroups.flatMap((group) => group.sections.flatMap((section) => section.items)),
        ...keyStudentLists.flatMap((list) => list.items)
      ]
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
