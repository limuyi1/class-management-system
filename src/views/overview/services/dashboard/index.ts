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
  const trendStudents = options.trendStudents ?? options.students
  const trendHeaders = options.trendHeaders ?? options.unitHeaders
  // 只有本期有成绩的学生才生成当前画像，历史参照不能冒充本期状态。
  const eligibleStudents = options.trendStudents
    ? trendStudents.filter((student) =>
        options.unitHeaders.some(
          (header) =>
            typeof student[header.prop] === 'number' && Number.isFinite(student[header.prop])
        )
      )
    : trendStudents
  const studentMetrics = buildStudentMetrics(
    eligibleStudents,
    trendHeaders,
    unitMetrics,
    options.config,
    options.rankByProp
  )

  return buildOverviewDashboardData(options, unitMetrics, studentMetrics)
}

/** 重新导出构建入参类型，便于调用方直接从入口文件导入 */
export type { BuildOverviewDashboardDataOptions } from '@/views/overview/services/dashboard/types'
