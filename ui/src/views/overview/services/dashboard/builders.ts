/** 总览数据聚合，组合各业务构建器。 */
import { buildFocusGroups, buildKeyStudentLists } from './focus-builders'
import {
  buildSummaryCards,
  buildTeachingInsights,
  buildEvaluationOverview,
  buildDashboardKpi
} from './summary-builders'
import { buildStudentTrend, buildStudentOptions } from './trend-builders'

import type { DashboardDataType, DashboardUnitOverviewType } from '@/types/OverviewDashboard'
import type {
  BuildOverviewDashboardDataOptions,
  StudentMetricType,
  UnitMetricType
} from '@/views/overview/services/dashboard/types'

/** 将单元统计精简为总览展示所需的字段 */
export const toDashboardUnitOverview = ({
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
 * quickStudents 用于快速定位，按 studentId 去重收集关注学生（最多16个）。
 *
 * @param options 构建入参
 * @param unitMetrics 单元维度统计列表
 * @param metrics 学生画像列表
 * @returns 组装后的总览展示数据
 */
export const buildOverviewDashboardData = (
  options: BuildOverviewDashboardDataOptions,
  unitMetrics: UnitMetricType[],
  metrics: StudentMetricType[]
): DashboardDataType => {
  const { students, unitHeaders, selectedStudentIds, aiConfigured, config } = options
  const kpi = buildDashboardKpi(unitMetrics, metrics, config, unitHeaders.length)
  const focusGroups = buildFocusGroups(metrics, config)
  const keyStudentLists = buildKeyStudentLists(metrics, config)
  // 用 Map 按 studentId 去重，合并各分组与名单中的学生
  const quickStudentMap = new Map(
    [
      ...focusGroups.flatMap((group) => group.sections.flatMap((section) => section.items)),
      ...keyStudentLists.flatMap((list) => list.items)
    ].map((item) => [item.studentId, { studentId: item.studentId, name: item.name }])
  )
  const quickStudents = Array.from(quickStudentMap.values()).slice(0, 16)

  return {
    unitHeaders,
    unitOverview: unitMetrics.map(toDashboardUnitOverview),
    teachingInsights: buildTeachingInsights(unitMetrics),
    kpi,
    summaryCards: buildSummaryCards(metrics, kpi, config),
    focusGroups,
    keyStudentLists,
    studentOptions: buildStudentOptions(students),
    quickStudents,
    studentTrend: buildStudentTrend(
      metrics,
      selectedStudentIds.slice(0, config.studentTrend.maxCompareCount),
      config,
      options.trendHeaders ?? unitHeaders,
      kpi
    ),
    evaluationOverview: buildEvaluationOverview(students, aiConfigured)
  }
}
