import { describe, expect, it } from 'vitest'

import {
  buildStudentTrendChartOption,
  buildStudentTrendSummaries,
  formatStudentTrendTooltip,
  getStudentAverageDisplayScore,
  getStudentTrendTooltipScoreText
} from '@/views/overview/services/dashboard/trend-chart'
import type { DashboardStudentTrendType } from '@/types/HomeDashboard'

/**
 * trend-chart 服务函数测试
 * 测试目标：学生趋势图表数据构建（tooltip 文案、均值参考线、汇总文案、折线/柱状图配置）
 * 覆盖功能：tooltip 分数格式化、平均分标签防重叠、单人对比汇总、单/对比模式的图表序列
 */

// 构造单人趋势数据：三个单元成绩、班级均分 80、已生成评语
const createTrend = (): DashboardStudentTrendType => ({
  mode: 'single',
  classAverageScore: 80,
  summaries: ['整体表现稳定'],
  students: [
    {
      studentId: 'student-1',
      name: '张三',
      scoreCount: 3,
      completedComment: true,
      commentPreview: '评语',
      tags: [],
      trendPoints: [
        { label: '第一单元', score: 70 },
        { label: '第二单元', score: 85 },
        { label: '第三单元', score: 90 }
      ]
    }
  ]
})

// 覆盖趋势图表各工具函数的纯函数行为
describe('trend-chart', () => {
  it('should format tooltip scores for normal and average series', () => {
    expect(getStudentTrendTooltipScoreText('张三', 88)).toBe('88 分')
    expect(getStudentTrendTooltipScoreText('个人平均分（81.7分）', 82)).toBe('81.7分')
    expect(getStudentTrendTooltipScoreText('张三', null)).toBe('--')

    expect(
      formatStudentTrendTooltip([
        {
          axisValueLabel: '第一单元',
          marker: '<i></i>',
          seriesName: '张三',
          value: 88
        }
      ])
    ).toContain('第一单元')
  })

  it('should avoid overlapping average reference labels when averages are close', () => {
    expect(getStudentAverageDisplayScore(80, 80.2)).toBe(80.45)
    expect(getStudentAverageDisplayScore(80, 78.8)).toBe(78.8)
  })

  it('should append single-student comparison summaries', () => {
    expect(buildStudentTrendSummaries(createTrend())).toEqual([
      '整体表现稳定',
      '1 个单元低于班级均分，2 个单元高于或等于班级均分',
      '1 个单元低于个人均分，2 个单元高于或等于个人均分'
    ])
  })

  it('should build line chart with student and reference series for single trend', () => {
    const option = buildStudentTrendChartOption(createTrend(), 'line')
    const series = option.series as Array<{ name: string; type: string; data: unknown[] }>

    expect(series.map((item) => item.name)).toEqual([
      '张三',
      '班级整体均分（80.0分）',
      '个人平均分（81.7分）'
    ])
    expect(series.map((item) => item.type)).toEqual(['line', 'line', 'line'])
    expect(series[0].data).toEqual([70, 85, 90])
  })

  it('should build bar chart for compare mode without reference series', () => {
    const trend = createTrend()
    trend.mode = 'compare'
    const option = buildStudentTrendChartOption(trend, 'bar')
    const series = option.series as Array<{ name: string; type: string }>

    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({
      name: '张三',
      type: 'bar'
    })
  })
})
