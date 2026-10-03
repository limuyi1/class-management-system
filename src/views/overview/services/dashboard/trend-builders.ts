/** 学生趋势与对比选项组装。 */
import { getStudentName } from '@/views/overview/services/dashboard/helpers'

import type {
  DashboardKpiType,
  DashboardStudentOptionType,
  DashboardStudentTrendType,
  OverviewDashboardConfigType
} from '@/types/OverviewDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import type { StudentMetricType } from '@/views/overview/services/dashboard/types'

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
 *
 * @param metrics 学生画像列表
 * @param selectedStudentIds 选中的学生 ID 列表
 * @param config 总览页配置
 * @param unitHeaders 单元表头配置
 * @param kpi 班级 KPI 指标（可选，用于提供班级均分参考线）
 * @returns 趋势分析数据，无有效选中学生时返回 null
 */
export const buildStudentTrend = (
  metrics: StudentMetricType[],
  selectedStudentIds: string[],
  config: OverviewDashboardConfigType,
  unitHeaders: SettingType[],
  kpi?: DashboardKpiType
): DashboardStudentTrendType | null => {
  const selectedMetrics = selectedStudentIds
    .map((studentId) => metrics.find((metric) => metric.studentId === studentId))
    .filter((item): item is StudentMetricType => item !== undefined)

  if (!selectedMetrics.length) return null

  const summaries: string[] = []

  if (selectedMetrics.length === 1) {
    const metric = selectedMetrics[0]

    // 按显著下降 → 显著回升 → 高波动 → 平稳 的顺序生成单生走势摘要
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

    summaries.push(
      `当前已录入 ${metric.points.length} 个单元，均分 ${metric.averageScore.toFixed(1)} 分`
    )
  } else {
    // 多人对比模式：分别找出均分最高与波动最大的学生生成摘要
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
      // 按单元 prop 快速索引成绩点，再按表头顺序映射为趋势折线数据（缺失单元置 null）
      const pointMap = new Map(metric.points.map((point) => [point.prop, point.score]))

      return {
        studentId: metric.studentId,
        name: metric.name,
        scoreCount: metric.points.length,
        completedComment: commentPreview.length > 0,
        commentPreview,
        tags: metric.matchedTags,
        trendPoints: unitHeaders.map((header) => ({
          label: header.label,
          score: pointMap.get(header.prop) ?? null
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
 *
 * @param students 学生数据列表
 * @returns 学生下拉选项列表
 */
export const buildStudentOptions = (students: StudentDataType[]): DashboardStudentOptionType[] => {
  return students
    .map((student) => ({
      label: getStudentName(student),
      value: student.studentId
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))
}
