import { buildOverviewDashboardData } from '@/views/overview/services/dashboard/builders'
import { buildStudentMetrics, buildUnitMetrics } from '@/views/overview/services/dashboard/metrics'
import type { BuildOverviewDashboardDataOptions } from '@/views/overview/services/dashboard/types'

/**
 * 班级总览数据构建总入口。
 * 页面和测试只依赖这个入口，内部拆分可继续演进而不影响调用方。
 * 先分别计算单元与学生的统计画像，再统一组装为最终展示数据。
 *
 * @param options 构建入参
 * @returns 组装后的总览数据
 */
export const buildDashboardData = (options: BuildOverviewDashboardDataOptions) => {
  const unitMetrics = buildUnitMetrics(options.students, options.unitHeaders, options.config)
  const studentMetrics = buildStudentMetrics(options.students, options.unitHeaders, unitMetrics, options.config)

  return buildOverviewDashboardData(options, unitMetrics, studentMetrics)
}

export type { BuildOverviewDashboardDataOptions } from '@/views/overview/services/dashboard/types'
