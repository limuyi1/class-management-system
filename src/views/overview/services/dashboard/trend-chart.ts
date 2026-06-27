import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'

import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import type { DashboardStudentTrendType } from '@/types/HomeDashboard'

const chartColors = ['#0f766e', '#2563eb', '#f97316', '#dc2626', '#7c3aed']
const chartAreaColors = [
  'rgba(15, 118, 110, 0.1)',
  'rgba(37, 99, 235, 0.1)',
  'rgba(249, 115, 22, 0.1)',
  'rgba(220, 38, 38, 0.1)',
  'rgba(124, 58, 237, 0.1)'
]
const singleTrendReferenceLineColors = {
  classAverage: '#7c3aed',
  studentAverage: '#dc2626'
}

interface TooltipRowType {
  axisValueLabel?: string
  marker?: string
  seriesName?: string
  value?: unknown
}

export function getStudentTrendTooltipScoreText(seriesName: string, value: unknown): string {
  const averageScoreText = seriesName.match(/（([^）]+分)）$/)?.[1]
  if (averageScoreText) return averageScoreText
  return typeof value === 'number' ? `${value} 分` : '--'
}

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

export function formatStudentTrendAverageLegendName(label: string, value: number): string {
  return `${label}（${value.toFixed(1)}分）`
}

export function getStudentAverageDisplayScore(
  classAverageScore: number,
  studentAverageScore: number
): number {
  if (Math.abs(classAverageScore - studentAverageScore) >= 1) return studentAverageScore
  if (studentAverageScore >= classAverageScore) {
    return studentAverageScore <= 99.75 ? studentAverageScore + 0.25 : studentAverageScore - 0.25
  }

  return studentAverageScore >= 0.25 ? studentAverageScore - 0.25 : studentAverageScore + 0.25
}

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

export function buildStudentTrendChartOption(
  trend: DashboardStudentTrendType | null,
  chartMode: 'line' | 'bar'
): EChartsOption {
  const students = trend?.students || []
  const shouldShowLineScoreLabel = trend?.mode === 'single'
  const xAxisLabels = Array.from(
    new Set(students.flatMap((student) => student.trendPoints.map((point) => point.label)))
  )
  const showDataZoom = xAxisLabels.length > overviewDashboardConfig.unitOverview.dataZoomThreshold

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

  const series: Array<LineSeriesOption | BarSeriesOption> = students.map((student, index) => {
    const studentScoreMap = new Map(student.trendPoints.map((point) => [point.label, point.score]))
    const data = xAxisLabels.map((label) => studentScoreMap.get(label) ?? null)
    const color = chartColors[index % chartColors.length]

    if (chartMode === 'bar') {
      return {
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
