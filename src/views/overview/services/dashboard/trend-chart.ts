import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'

import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import type { DashboardStudentTrendType } from '@/types/HomeDashboard'

/** 各学生系列的折线/柱状配色，按学生顺序循环取用 */
const chartColors = ['#0f766e', '#2563eb', '#f97316', '#dc2626', '#7c3aed']
/** 折线系列对应的面积填充色，与 chartColors 一一对应 */
const chartAreaColors = [
  'rgba(15, 118, 110, 0.1)',
  'rgba(37, 99, 235, 0.1)',
  'rgba(249, 115, 22, 0.1)',
  'rgba(220, 38, 38, 0.1)',
  'rgba(124, 58, 237, 0.1)'
]
/** 单人模式下班级均分与个人均分参考线的颜色 */
const singleTrendReferenceLineColors = {
  classAverage: '#7c3aed',
  studentAverage: '#dc2626'
}

/** Tooltip 单行数据（来自 ECharts 的 params 数组项） */
interface TooltipRowType {
  /** X 轴类目标签（如单元名称） */
  axisValueLabel?: string
  /** 系列对应的图例标记（HTML 字符串） */
  marker?: string
  /** 系列名称（如学生姓名或均分参考线名称） */
  seriesName?: string
  /** 当前数据点的值 */
  value?: unknown
}

/**
 * 解析趋势图 Tooltip 中某个系列的分数文本。
 *
 * 系列名若带“（89.5分）”形式的均分后缀，优先展示括号内文本；
 * 否则按数值格式化，非数字回退为“--”。
 *
 * @param seriesName 系列名称
 * @param value 当前数据点的值
 * @returns 用于 Tooltip 展示的分数文本
 */
export function getStudentTrendTooltipScoreText(seriesName: string, value: unknown): string {
  const averageScoreText = seriesName.match(/（([^）]+分)）$/)?.[1]
  if (averageScoreText) return averageScoreText
  return typeof value === 'number' ? `${value} 分` : '--'
}

/**
 * 生成学生趋势图的 Tooltip HTML。
 *
 * @param params ECharts 传入的 Tooltip 参数
 * @returns Tooltip HTML 字符串
 */
export function formatStudentTrendTooltip(params: unknown): string {
  const items = Array.isArray(params) ? (params as TooltipRowType[]) : []
  const title = items[0]?.axisValueLabel || ''
  const rows = items
    .map((item) => {
      const seriesName = item.seriesName || ''
      const tooltipName = seriesName.replace(/（[^）]+分）$/, '')
      const scoreText = getStudentTrendTooltipScoreText(seriesName, item.value)

      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:6px;">
        <span>${item.marker || ''}${tooltipName}</span>
        <strong style="color:#0f172a;">${scoreText}</strong>
      </div>`
    })
    .join('')

  return `<div style="min-width:140px;">
    <div style="font-weight:600;color:#0f172a;margin-bottom:2px;">${title}</div>
    ${rows}
  </div>`
}

/**
 * 生成均分参考线的图例名称，附一位小数均分。
 *
 * @param label 图例标题（如“班级整体均分”）
 * @param value 均分数值
 * @returns 形如“班级整体均分（89.5分）”的图例名
 */
export function formatStudentTrendAverageLegendName(label: string, value: number): string {
  return `${label}（${value.toFixed(1)}分）`
}

/**
 * 计算个人均分参考线的显示值。
 *
 * 当个人均分与班级均分非常接近（差值小于 1 分）时，两条参考线会重叠，
 * 此时对个人均分做 ±0.25 的微调让两条线错开；差距明显时直接使用真实均分。
 *
 * @param classAverageScore 班级均分
 * @param studentAverageScore 个人均分
 * @returns 用于绘制的个人均分显示值
 */
export function getStudentAverageDisplayScore(
  classAverageScore: number,
  studentAverageScore: number
): number {
  if (Math.abs(classAverageScore - studentAverageScore) >= 1) return studentAverageScore
  // 个人均分不低于班级均分时向上微调，接近满分时改为向下避免越界
  if (studentAverageScore >= classAverageScore) {
    return studentAverageScore <= 99.75 ? studentAverageScore + 0.25 : studentAverageScore - 0.25
  }

  // 个人均分低于班级均分时向下微调，接近 0 时改为向上避免越界
  return studentAverageScore >= 0.25 ? studentAverageScore - 0.25 : studentAverageScore + 0.25
}

/**
 * 组装趋势分析的摘要文案。
 *
 * 单人模式下会额外补充“低于/高于班级均分、个人均分”的统计；
 * 多人对比模式直接返回原始摘要。
 *
 * @param trend 趋势分析数据
 * @returns 摘要文案数组
 */
export function buildStudentTrendSummaries(trend: DashboardStudentTrendType | null): string[] {
  if (!trend) return []

  const summaries = [...trend.summaries]
  if (trend.mode !== 'single') return summaries

  const student = trend.students[0]
  if (!student?.trendPoints.length) return summaries

  const scores = student.trendPoints
    .map((point) => point.score)
    .filter((score): score is number => typeof score === 'number')
  if (!scores.length) return summaries

  const studentAverageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

  if (trend.classAverageScore !== undefined) {
    const belowClassAverageCount = scores.filter((score) => score < trend.classAverageScore!).length
    const aboveClassAverageCount = scores.filter(
      (score) => score >= trend.classAverageScore!
    ).length
    summaries.push(
      `${belowClassAverageCount} 个单元低于班级均分，${aboveClassAverageCount} 个单元高于或等于班级均分`
    )
  }

  const belowStudentAverageCount = scores.filter((score) => score < studentAverageScore).length
  const aboveStudentAverageCount = scores.filter((score) => score >= studentAverageScore).length
  summaries.push(
    `${belowStudentAverageCount} 个单元低于个人均分，${aboveStudentAverageCount} 个单元高于或等于个人均分`
  )

  return summaries
}

/**
 * 构建学生趋势图的 ECharts 配置。
 *
 * 支持折线/柱状两种模式；单人模式会追加班级均分与个人均分的参考线，
 * 单元数超过阈值时自动启用缩放控制器。
 *
 * @param trend 趋势分析数据
 * @param chartMode 图表类型：折线（line）或柱状（bar）
 * @returns ECharts 配置对象
 */
export function buildStudentTrendChartOption(
  trend: DashboardStudentTrendType | null,
  chartMode: 'line' | 'bar'
): EChartsOption {
  const students = trend?.students || []
  const shouldShowLineScoreLabel = trend?.mode === 'single'
  // 汇总所有学生出现过的单元标签作为 X 轴类目，保证多系列数据对齐
  const xAxisLabels = Array.from(
    new Set(students.flatMap((student) => student.trendPoints.map((point) => point.label)))
  )
  const showDataZoom = xAxisLabels.length > overviewDashboardConfig.unitOverview.dataZoomThreshold

  // 仅单人模式下需要计算个人均分，用于绘制个人均分参考线
  const studentAverageScore =
    students.length === 1 &&
    students[0].trendPoints.some((point) => typeof point.score === 'number')
      ? (() => {
          const scores = students[0].trendPoints
            .map((point) => point.score)
            .filter((score): score is number => typeof score === 'number')

          return scores.reduce((sum, score) => sum + score, 0) / scores.length
        })()
      : null

  // 参考线仅单人模式展示：班级均分用虚线，个人均分用实线
  const referenceSeries: LineSeriesOption[] = []

  if (trend?.mode === 'single') {
    if (trend.classAverageScore !== undefined) {
      const classAverageScore = Number(trend.classAverageScore.toFixed(1))
      referenceSeries.push({
        name: formatStudentTrendAverageLegendName('班级整体均分', classAverageScore),
        type: 'line',
        smooth: false,
        symbol: 'none',
        lineStyle: {
          color: singleTrendReferenceLineColors.classAverage,
          type: 'dashed',
          width: 2
        },
        itemStyle: {
          color: singleTrendReferenceLineColors.classAverage
        },
        label: {
          show: false
        },
        emphasis: {
          disabled: true
        },
        data: xAxisLabels.map(() => classAverageScore),
        z: 1
      })
    }

    if (studentAverageScore !== null) {
      const averageScore = Number(studentAverageScore.toFixed(1))
      const classAverageScore = trend.classAverageScore
      const displayAverageScore =
        classAverageScore === undefined
          ? averageScore
          : getStudentAverageDisplayScore(Number(classAverageScore.toFixed(1)), averageScore)

      referenceSeries.push({
        name: formatStudentTrendAverageLegendName('个人平均分', averageScore),
        type: 'line',
        smooth: false,
        symbol: 'none',
        lineStyle: {
          color: singleTrendReferenceLineColors.studentAverage,
          type: 'solid',
          width: 1.8,
          opacity: 0.88
        },
        itemStyle: {
          color: singleTrendReferenceLineColors.studentAverage
        },
        label: {
          show: false
        },
        emphasis: {
          disabled: true
        },
        data: xAxisLabels.map(() => displayAverageScore),
        z: 1
      })
    }
  }

  // 每个学生生成一个数据系列，柱状与折线共用同一份按 X 轴对齐的数据
  const series: Array<LineSeriesOption | BarSeriesOption> = students.map((student, index) => {
    const studentScoreMap = new Map(student.trendPoints.map((point) => [point.label, point.score]))
    const data = xAxisLabels.map((label) => studentScoreMap.get(label) ?? null)
    const color = chartColors[index % chartColors.length]

    if (chartMode === 'bar') {
      return {
        id: student.studentId,
        name: student.name,
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: {
          color,
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: 'inside',
          color: '#ffffff',
          fontSize: 11,
          fontWeight: 600,
          formatter: ({ value }) => (typeof value === 'number' ? String(value) : '')
        },
        data
      }
    }

    return {
      id: student.studentId,
      name: student.name,
      type: 'line',
      smooth: true,
      smoothMonotone: 'x',
      symbolSize: 8,
      itemStyle: {
        color
      },
      lineStyle: {
        width: 3,
        color
      },
      areaStyle: {
        color: chartAreaColors[index % chartAreaColors.length]
      },
      label: {
        show: shouldShowLineScoreLabel,
        position: 'top',
        color,
        fontSize: 11,
        fontWeight: 600,
        formatter: ({ value }) => (typeof value === 'number' ? String(value) : '')
      },
      data
    }
  })

  return {
    animationDuration: 800,
    animationEasing: 'cubicOut',
    color: chartColors,
    tooltip: {
      trigger: 'axis',
      confine: true,
      padding: [10, 12],
      borderWidth: 1,
      borderColor: '#e2e8f0',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      textStyle: {
        color: '#334155'
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#94a3b8',
          type: 'dashed'
        }
      },
      formatter: formatStudentTrendTooltip
    },
    legend: {
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: {
        color: '#64748b'
      }
    },
    grid: {
      left: 48,
      right: 20,
      top: 46,
      bottom: showDataZoom ? 70 : 40
    },
    dataZoom: showDataZoom
      ? [
          {
            type: 'inside',
            xAxisIndex: 0,
            start: 0,
            end: 100
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            bottom: 12,
            height: 20,
            brushSelect: false,
            start: 0,
            end: 100
          }
        ]
      : [],
    xAxis: {
      type: 'category',
      data: xAxisLabels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: {
        lineStyle: {
          color: '#edf2f7'
        }
      },
      axisLabel: { color: '#64748b' }
    },
    series: [...series, ...referenceSeries]
  }
}
