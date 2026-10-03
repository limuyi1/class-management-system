import type { EChartsOption, LineSeriesOption } from 'echarts'
import type { StudentReportDataType } from '@/utils/studentReportUtil'

/**
 * 生成均分参考线的图例名称（附带分值）
 * @param label - 图例标签
 * @param value - 均分分值
 * @returns 图例展示名称
 */
const formatAverageLegendName = (label: string, value: number): string =>
  `${label}（${value.toFixed(1)}分）`

/**
 * 计算学生个人均分在图上的展示分数。
 * 当个人均分与班级均分过近时，做 ±0.25 的微小偏移，避免两条参考线重叠。
 * @param classAverageScore - 班级均分
 * @param studentAverageScore - 学生个人均分
 * @returns 用于绘图的学生均分展示值
 */
const getStudentAverageDisplayScore = (
  classAverageScore: number,
  studentAverageScore: number
): number => {
  if (Math.abs(classAverageScore - studentAverageScore) >= 1) return studentAverageScore
  if (studentAverageScore >= classAverageScore) {
    return studentAverageScore <= 99.75 ? studentAverageScore + 0.25 : studentAverageScore - 0.25
  }

  return studentAverageScore >= 0.25 ? studentAverageScore - 0.25 : studentAverageScore + 0.25
}

/**
 * 从图例名称中提取均分分值作为 tooltip 展示文本
 * @param seriesName - 系列名称
 * @param value - 系列值
 * @returns tooltip 分值文案
 */
const getTooltipScoreText = (seriesName: string, value: unknown): string => {
  const averageScoreText = seriesName.match(/（([^）]+分)）$/)?.[1]
  if (averageScoreText) return averageScoreText
  return typeof value === 'number' ? `${value} 分` : '--'
}

/** 根据报告数据构建趋势图，缺少有效成绩时返回空配置。 */
export function buildStudentReportChartOptions(report: StudentReportDataType): EChartsOption {
  const items = report.scoreItems
  const validItems = items.filter(
    (item): item is StudentReportDataType['scoreItems'][number] & { score: number } =>
      typeof item.score === 'number'
  )
  if (!items.length || !validItems.length) {
    return {}
  }

  // 结合成绩与两条参考线动态计算纵轴范围，并按 10 分档对齐
  const referenceScores = [report.classAverageScore, report.summary.averageScore]
  const scoreRangeValues = [...validItems.map((item) => item.score), ...referenceScores]
  const maxScore = Math.max(...scoreRangeValues, 100)
  const minScore = Math.min(...scoreRangeValues, 40)
  const ceiling = Math.ceil(maxScore / 10) * 10
  const floor = Math.max(Math.floor(minScore / 10) * 10 - 10, 0)
  const start = Math.max(floor, 0)
  const end = Math.max(ceiling, start + 20)
  const xAxisLabels = items.map((item) => item.label)
  const studentAverageDisplayScore = getStudentAverageDisplayScore(
    report.classAverageScore,
    report.summary.averageScore
  )
  // 班级均分（虚线）与个人均分（实线）两条水平参考线
  const referenceSeries: LineSeriesOption[] = [
    {
      name: formatAverageLegendName('班级整体均分', report.classAverageScore),
      type: 'line',
      smooth: false,
      symbol: 'none',
      lineStyle: {
        color: '#7c3aed',
        type: 'dashed',
        width: 2
      },
      itemStyle: {
        color: '#7c3aed'
      },
      label: {
        show: false
      },
      emphasis: {
        disabled: true
      },
      data: xAxisLabels.map(() => report.classAverageScore),
      z: 1
    },
    {
      name: formatAverageLegendName('个人平均分', report.summary.averageScore),
      type: 'line',
      smooth: false,
      symbol: 'none',
      lineStyle: {
        color: '#dc2626',
        type: 'solid',
        width: 1.8,
        opacity: 0.88
      },
      itemStyle: {
        color: '#dc2626'
      },
      label: {
        show: false
      },
      emphasis: {
        disabled: true
      },
      data: xAxisLabels.map(() => studentAverageDisplayScore),
      z: 1
    }
  ]

  return {
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: {
      left: 10,
      right: 12,
      top: 42,
      bottom: 22,
      containLabel: true
    },
    legend: {
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: {
        color: '#6e6358',
        fontSize: 12
      }
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      padding: [10, 12],
      borderWidth: 1,
      borderColor: '#eadbc7',
      backgroundColor: 'rgba(255, 252, 246, 0.98)',
      textStyle: {
        color: '#40352c'
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#9bbfc0',
          type: 'dashed'
        }
      },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params)
          ? (params as Array<{
              axisValueLabel?: string
              marker?: string
              seriesName?: string
              value?: unknown
            }>)
          : []
        const title = rows[0]?.axisValueLabel || ''
        const content = rows
          .map((item) => {
            const seriesName = item.seriesName || ''
            // 图例名带分值后缀，tooltip 中去掉后缀以免重复展示
            const tooltipName = seriesName.replace(/（[^）]+分）$/, '')
            const scoreText = getTooltipScoreText(seriesName, item.value)

            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:6px;">
              <span>${item.marker || ''}${tooltipName}</span>
              <strong>${scoreText}</strong>
            </div>`
          })
          .join('')

        return `<div style="min-width:120px;">
          <div style="font-weight:600;margin-bottom:2px;">${title}</div>
          ${content}
        </div>`
      }
    },
    xAxis: {
      type: 'category',
      data: xAxisLabels,
      axisTick: { show: false },
      axisLine: {
        lineStyle: {
          color: '#d8cbbb'
        }
      },
      axisLabel: {
        color: '#4f4237',
        fontSize: 12,
        margin: 12
      }
    },
    yAxis: {
      type: 'value',
      min: start,
      max: end,
      // 纵轴约分 4 段，刻度按 10 分取整并保底 10
      interval: Math.max(Math.round((end - start) / 4 / 10) * 10, 10),
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#6e6358',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: '#e7ddcf',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: '成绩',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        lineStyle: {
          width: 3,
          color: '#0f8a87'
        },
        itemStyle: {
          color: '#0f8a87',
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'top',
          color: '#3a3128',
          fontSize: 12,
          fontWeight: 700
        },
        areaStyle: {
          color: 'rgba(15, 138, 135, 0.08)'
        },
        data: items.map((item) => item.score)
      },
      ...referenceSeries
    ]
  }
}
