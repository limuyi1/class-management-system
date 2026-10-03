/** 总览摘要、教学建议与完成度组装。 */
import { averageOf } from '@/views/overview/services/dashboard/helpers'
import { isDownwardDirection, isUpwardDirection } from './student-directions'

import type {
  DashboardEvaluationOverviewType,
  DashboardFocusGroupKeyType,
  DashboardKpiType,
  DashboardSummaryCardType,
  DashboardTeachingInsightType,
  OverviewDashboardConfigType
} from '@/types/OverviewDashboard'
import type { StudentDataType } from '@/types/StudentData'
import type { StudentMetricType, UnitMetricType } from '@/views/overview/services/dashboard/types'

/**
 * 生成总览页左侧的汇总卡片数据。
 *
 * 包含五类卡片：
 * - 立即关注：需要优先处理的学生数量及细分标签
 * - 值得鼓励：进步学生数量（不含"高分稳定"，因稳定不属于进步）
 * - 中段变化：中段层学生的变化情况
 * - 波动观察：波动学生的上行/下行分布
 * - 班级概况：整体均分、及格率、单元完成进度
 *
 * @param metrics 学生画像列表
 * @param kpi 班级 KPI 指标
 * @param config 总览页配置
 * @returns 汇总卡片列表
 */
export const buildSummaryCards = (
  metrics: StudentMetricType[],
  kpi: DashboardKpiType,
  config: OverviewDashboardConfigType
): DashboardSummaryCardType[] => {
  /** 筛选命中指定标签分组的学生 */
  const groupStudents = (groupKey: DashboardFocusGroupKeyType) =>
    metrics.filter((metric) => metric.matchedTags.some((tag) => tag.group === groupKey))

  /** 统计指定分组内每个标签的命中人数（过滤掉无人命中的标签） */
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
 * 生成教学提示：每个单元的突出特点。
 *
 * 四个维度：
 * - 班均最低：该单元班级均分最低，需重点关注
 * - 低分人数最多：该单元不及格学生最多，教学难度大
 * - 差异最大：该单元标准差最大，学生分化严重
 * - 波动最明显：该单元与前一单元均分差异最大
 *
 * @param unitMetrics 单元维度统计列表
 * @returns 教学提示列表
 */
export const buildTeachingInsights = (
  unitMetrics: UnitMetricType[]
): DashboardTeachingInsightType[] => {
  if (!unitMetrics.length) return []

  const lowestAverage = [...unitMetrics].sort((a, b) => a.averageScore - b.averageScore)[0]
  const mostLowScores = [...unitMetrics].sort((a, b) => b.lowScoreCount - a.lowScoreCount)[0]
  const largestGap = [...unitMetrics].sort((a, b) => b.standardDeviation - a.standardDeviation)[0]
  // 与前一单元的均分差（相邻差值）最大的单元即为“波动最明显”
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
 * 生成评语完成情况概览。
 * 统计已写评语人数、待写人数和完成率。
 * aiConfigured 用于提示用户是否已配置 AI 可辅助生成评语。
 *
 * @param students 学生数据列表
 * @param aiConfigured 是否已配置 AI 生成评语
 * @returns 评语完成情况概览数据
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
 *
 * @param unitMetrics 单元维度统计列表
 * @param metrics 学生画像列表
 * @param config 总览页配置
 * @param totalUnitCount 单元总数
 * @returns 班级 KPI 指标
 */
export const buildDashboardKpi = (
  unitMetrics: UnitMetricType[],
  metrics: StudentMetricType[],
  config: OverviewDashboardConfigType,
  totalUnitCount: number
): DashboardKpiType => {
  const allScores = metrics.flatMap((metric) => metric.points.map((point) => point.score))
  const averageScore = averageOf(allScores)
  // 及格人数 = 分数段下限不低于及格线的分段人数之和
  const passRates = unitMetrics.map((unit) => {
    const passedCount = unit.scoreBands
      .filter((band) => band.min >= config.tagRules.passLine)
      .reduce((sum, band) => sum + band.count, 0)

    return unit.validCount ? (passedCount / unit.validCount) * 100 : 0
  })
  const attentionStudentCount = metrics.filter((metric) =>
    metric.matchedTags.some((tag) => tag.group === 'attention')
  ).length
  // 均分偏离总体均分（取绝对值）最大的单元
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
