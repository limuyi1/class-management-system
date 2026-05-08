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
  DashboardUnitOverviewType,
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

const isDownwardDirection = (direction?: StudentMetricType['volatilityDirection']) =>
  direction === 'down' || direction === 'volatileDown'

const isUpwardDirection = (direction?: StudentMetricType['volatilityDirection']) =>
  direction === 'up' || direction === 'volatileUp'

/**
 * 生成总览页右侧”学生观察站”的分组结构。
 *
 * 分组结构：四类标签组（立即关注/值得鼓励/中段变化/波动观察），
 * 每组下包含多个标签区块（如”突发异常”、”下滑关注”等）。
 * 区块内的学生按推荐分数排序，同一标签优先展示。
 * 波动标签会被细分为”波动上行”和”波动下行”两个区块。
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
          // 区块排序以标签 priority 为主，展示层不再自行写死“立即关注”等分组顺序。
          // 这样后续只需要调整 dashboard 常量里的 priority，就能统一影响卡片、标签和区块顺序。
          priority: tag.priority,
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

/**
 * 生成总览页左侧的汇总卡片数据。
 *
 * 包含五类卡片：
 * - 立即关注：需要优先处理的学生数量及细分标签
 * - 值得鼓励：进步学生数量（不含"高分稳定"，因稳定不属于进步）
 * - 中段变化：中段层学生的变化情况
 * - 波动观察：波动学生的上行/下行分布
 * - 班级概况：整体均分、及格率、单元完成进度
 */
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
              isDownwardDirection(metric.volatilityDirection)
          ).length
        },
        {
          label: '波动上行',
          value: metrics.filter(
            (metric) =>
              metric.matchedTags.some((tag) => tag.key === 'volatility') &&
              isUpwardDirection(metric.volatilityDirection)
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

/**
 * 生成关键学生列表（用于概览页左侧下方的学生列表展示）。
 *
 * 从三个分组（attention/encouragement/volatilityWatch）中各取最多 N 名学生。
 * 选取规则：按推荐分数排序，推荐分数相同则按标签优先级排序。
 * 波动观察组内再按中段变化类型细分排序。
 */
export const buildKeyStudentLists = (
  metrics: StudentMetricType[],
  config: HomeDashboardConfigType
): DashboardKeyStudentListType[] => {
  const labels: Record<DashboardFocusGroupKeyType, { label: string }> = {
    attention: {
      label: '需要马上关注'
    },
    encouragement: {
      label: '最近值得鼓励'
    },
    middleChange: {
      label: '波动观察'
    },
    volatilityWatch: {
      label: '波动观察'
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

/**
 * 生成教学提示：每个单元的突出特点。
 *
 * 四个维度：
 * - 班均最低：该单元班级均分最低，需重点关注
 * - 低分人数最多：该单元不及格学生最多，教学难度大
 * - 差异最大：该单元标准差最大，学生分化严重
 * - 波动最明显：该单元与前一单元均分差异最大
 */
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

/**
 * 生成趋势分析数据，支持单人聚焦和多人对比两种模式。
 *
 * 单人模式：
 * - 根据最新成绩较历史均分的差值生成描述
 * - 列出学生命中的所有标签
 * - 显示已录入单元数和均分
 *
 * 多人对比模式：
 * - 找出均分最高和波动最大的学生
 * - 生成对比摘要
 *
 * 两种模式都会限制摘要条数（由配置控制）。
 */
export const buildStudentTrend = (
  metrics: StudentMetricType[],
  selectedStudentNames: string[],
  config: HomeDashboardConfigType,
  kpi?: DashboardKpiType
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
    summaries: summaries.slice(0, config.studentTrend.summaryLimit),
    classAverageScore: kpi?.averageScore
  }
}

/**
 * 生成学生下拉选项列表。
 * 用于趋势分析抽屉的学生选择器。
 * 去重并按中文拼音排序。
 */
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

/**
 * 生成评语完成情况概览。
 * 统计已写评语人数、待写人数和完成率。
 * aiConfigured 用于提示用户是否已配置 AI 可辅助生成评语。
 */
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

/**
 * 生成 KPI 指标数据。
 *
 * 计算内容：
 * - averageScore：所有单元所有成绩的总体均分
 * - averagePassRate：各单元及格率的均分
 * - passRateFluctuation：各单元及格率的最大差异
 * - attentionStudentCount：命中"立即关注"标签的学生数
 * - biggestFluctuationUnitLabel：均分偏离总体均分最大的单元
 * - diagnosticText：诊断文本，用于 AI 分析输入
 */
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

const toDashboardUnitOverview = ({
  prop,
  label,
  averageScore,
  validCount,
  scoreBands
}: UnitMetricType): DashboardUnitOverviewType => ({
  prop,
  label,
  averageScore,
  validCount,
  scoreBands
})

/**
 * 总览数据构建总入口。
 *
 * 编排所有子模块的构建结果，组装成完整的 DashboardDataType。
 * 各子模块的数据流：
 *   unitMetrics ─┬─> buildDashboardKpi ─> summaryCards
 *                ├─> buildFocusGroups
 *                ├─> buildKeyStudentLists
 *                └─> buildTeachingInsights
 *
 *   metrics ─────┬─> buildFocusGroups
 *                ├─> buildKeyStudentLists
 *                ├─> buildStudentTrend
 *                └─> buildSummaryCards
 *
 * quickStudentNames 用于快速定位，收集关注学生和关键学生列表中出现的姓名（去重，最多16个）。
 */
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
    unitOverview: unitMetrics.map(toDashboardUnitOverview),
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
      config,
      kpi
    ),
    evaluationOverview: buildEvaluationOverview(students, aiConfigured)
  }
}
