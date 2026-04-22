import { describe, expect, it } from 'vitest'

import { homeDashboardConfig } from '../../src/config/home-dashboard'
import { buildHomeDashboardData } from '../../src/utils/homeDashboardUntil'

describe('homeDashboardUntil', () => {
  const unitHeaders = [
    { prop: 'unit1', label: '第一单元' },
    { prop: 'unit2', label: '第二单元' },
    { prop: 'unit3', label: '第三单元' }
  ]

  const students = [
    { xing4_ming2: '张三', unit1: 92, unit2: 95, unit3: 93, comment: '表现稳定' },
    { xing4_ming2: '李四', unit1: 55, unit2: 58, unit3: 54, comment: '' },
    { xing4_ming2: '王五', unit1: 88, unit2: 62, unit3: 91 },
    { xing4_ming2: '赵六', unit1: 82, unit2: 74, unit3: 60 }
  ]

  it('should build unit overview and evaluation summary', () => {
    const result = buildHomeDashboardData({
      students,
      unitHeaders,
      selectedStudentNames: ['张三'],
      aiConfigured: true,
      config: homeDashboardConfig
    })

    expect(result.unitOverview).toHaveLength(3)
    expect(result.unitOverview[0].averageScore).toBe(79.25)
    expect(result.evaluationOverview.pendingCount).toBe(3)
    expect(result.evaluationOverview.aiConfigured).toBe(true)
  })

  it('should create alert and ranking groups', () => {
    const result = buildHomeDashboardData({
      students,
      unitHeaders,
      selectedStudentNames: ['李四'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    const persistentLowScore = result.alertGroups.find((group) => group.key === 'persistentLowScore')
    const stableTopFive = result.rankingGroups.find((group) => group.key === 'stableTopFive')

    expect(persistentLowScore?.items[0].name).toBe('李四')
    expect(stableTopFive?.items.some((item) => item.name === '张三')).toBe(true)
  })

  it('should build student trend summaries for selected student', () => {
    const result = buildHomeDashboardData({
      students,
      unitHeaders,
      selectedStudentNames: ['王五'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    expect(result.studentTrend?.mode).toBe('single')
    expect(result.studentTrend?.students[0].name).toBe('王五')
    expect(result.studentTrend?.students[0].trendPoints).toHaveLength(3)
    expect(result.studentTrend?.summaries.length).toBeGreaterThan(0)
  })
})
