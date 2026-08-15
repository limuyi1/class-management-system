import { describe, expect, it } from 'vitest'

import { NAME_PROP } from '@/constants'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import { buildDashboardData } from '@/views/overview/services/dashboard'
import { buildStudentMetrics, buildUnitMetrics } from '@/views/overview/services/dashboard/metrics'

const unitHeaders: SettingType[] = [
  { prop: 'unit1', label: '第一单元', disabled: false },
  { prop: 'unit2', label: '第二单元', disabled: false },
  { prop: 'unit3', label: '第三单元', disabled: false },
  { prop: 'unit4', label: '第四单元', disabled: false }
]

const buildMetrics = (scores: number[]) => {
  const students: StudentDataType[] = [
    scores.reduce<StudentDataType>(
      (student, score, index) => ({
        ...student,
        [unitHeaders[index].prop]: score
      }),
      { studentId: 'student-1', [NAME_PROP]: '张三' }
    )
  ]
  const headers = unitHeaders.slice(0, scores.length)
  const unitMetrics = buildUnitMetrics(students, headers, overviewDashboardConfig)
  const metric = buildStudentMetrics(students, headers, unitMetrics, overviewDashboardConfig)[0]

  expect(metric).toBeDefined()
  return metric!
}

describe('overview dashboard difficulty shift', () => {
  it('does not mark a normal unit as hard just because the previous unit was easy', () => {
    const metric = buildMetrics([78, 90, 82.1])

    expect(metric.points.map((point) => point.difficultyShift)).toEqual(['normal', 'easy', 'normal'])
  })

  it('uses a stable recent normal baseline once enough normal units exist', () => {
    const metric = buildMetrics([78, 79, 77, 84])

    expect(metric.points.map((point) => point.difficultyShift)).toEqual([
      'normal',
      'normal',
      'normal',
      'easy'
    ])
  })
})

describe('overview dashboard student trend', () => {
  it('keeps empty-score units on the trend chart axis', () => {
    const dashboardData = buildDashboardData({
      students: [
        {
          studentId: 'student-1',
          [NAME_PROP]: '张三',
          unit1: 88,
          unit2: null,
          unit3: 92
        }
      ],
      unitHeaders: unitHeaders.slice(0, 3),
      selectedStudentIds: ['student-1'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    expect(dashboardData.studentTrend?.students[0].trendPoints).toEqual([
      { label: '第一单元', score: 88 },
      { label: '第二单元', score: null },
      { label: '第三单元', score: 92 }
    ])
  })
})
