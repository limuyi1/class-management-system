import { buildOverviewDashboardData } from '@/views/overview/services/dashboard/builders'
import { buildStudentMetrics, buildUnitMetrics } from '@/views/overview/services/dashboard/metrics'
import type { BuildOverviewDashboardDataOptions } from '@/views/overview/services/dashboard/types'

/**
 * 班级总览数据构建总入口。
 * 页面和测试只依赖这个入口，内部拆分可继续演进而不影响调用方。
 */
export const buildDashboardData = (options: BuildOverviewDashboardDataOptions) => {
  const unitMetrics = buildUnitMetrics(options.students, options.unitHeaders, options.config)
  const studentMetrics = buildStudentMetrics(options.students, options.unitHeaders, unitMetrics, options.config)

  return buildOverviewDashboardData(options, unitMetrics, studentMetrics)
}

export type { BuildOverviewDashboardDataOptions } from '@/views/overview/services/dashboard/types'
