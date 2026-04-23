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
    const declining = result.alertGroups.find((group) => group.key === 'declining')
    const stableTopFive = result.rankingGroups.find((group) => group.key === 'stableTopFive')

    expect(persistentLowScore?.items[0].name).toBe('李四')
    expect(declining?.label).toBe('下滑关注')
    const declinedStudent = declining?.items.find((item) => item.name === '赵六')
    expect(declinedStudent?.badge).toBe('下滑 14.0 分')
    expect(declinedStudent?.subtitle).toBe('最近较上次下滑：14.0 分')
    expect(stableTopFive?.items.some((item) => item.name === '张三')).toBe(true)
    expect(result.rankingGroups.some((group) => (group.key as string) === 'mostDeclined')).toBe(false)
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

  it('should sort declining students by actual decline severity', () => {
    const result = buildHomeDashboardData({
      students: [
        { xing4_ming2: '甲', unit1: 90, unit2: 80, unit3: 70, unit4: 60 },
        { xing4_ming2: '乙', unit1: 100, unit2: 100, unit3: 100, unit4: 70 }
      ],
      unitHeaders: [...unitHeaders, { prop: 'unit4', label: '第四单元' }],
      selectedStudentNames: ['甲'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    const declining = result.alertGroups.find((group) => group.key === 'declining')

    expect(declining?.items.map((item) => item.name)).toEqual(['乙', '甲'])
    expect(declining?.items.map((item) => item.badge)).toEqual(['下滑 30.0 分', '下滑 20.0 分'])
  })

  it('should sort rankings by their primary score rules', () => {
    const rankingUnitHeaders = [
      { prop: 'unit1', label: '第一单元' },
      { prop: 'unit2', label: '第二单元' },
      { prop: 'unit3', label: '第三单元' },
      { prop: 'unit4', label: '第四单元' }
    ]
    const result = buildHomeDashboardData({
      students: [
        { xing4_ming2: '均分最高', unit1: 100, unit2: 99, unit3: 98, unit4: 97 },
        { xing4_ming2: '次数更多', unit1: 96, unit2: 95, unit3: 94, unit4: 93 },
        { xing4_ming2: '进步更大', unit1: 60, unit2: 62, unit3: 90, unit4: 92 },
        { xing4_ming2: '进步较小', unit1: 70, unit2: 72, unit3: 84, unit4: 86 }
      ],
      unitHeaders: rankingUnitHeaders,
      selectedStudentNames: ['均分最高'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    const stableTopFive = result.rankingGroups.find((group) => group.key === 'stableTopFive')
    const mostImproved = result.rankingGroups.find((group) => group.key === 'mostImproved')

    expect(stableTopFive?.label).toBe('高分稳定')
    expect(stableTopFive?.items[0].name).toBe('均分最高')
    expect(mostImproved?.items[0].name).toBe('进步更大')
  })

  it('should prioritize current low scores in persistent low score alerts', () => {
    const result = buildHomeDashboardData({
      students: [
        { xing4_ming2: '最近已恢复', unit1: 40, unit2: 50, unit3: 80 },
        { xing4_ming2: '最近仍低分', unit1: 50, unit2: 80, unit3: 40 }
      ],
      unitHeaders,
      selectedStudentNames: ['最近仍低分'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    const persistentLowScore = result.alertGroups.find((group) => group.key === 'persistentLowScore')

    expect(persistentLowScore?.items[0].name).toBe('最近仍低分')
  })

  it('should prioritize recent decline in fluctuation alerts', () => {
    const result = buildHomeDashboardData({
      students: [
        { xing4_ming2: '回升波动', unit1: 60, unit2: 30, unit3: 90 },
        { xing4_ming2: '下降波动', unit1: 30, unit2: 90, unit3: 60 }
      ],
      unitHeaders,
      selectedStudentNames: ['下降波动'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    const largestFluctuation = result.alertGroups.find((group) => group.key === 'largestFluctuation')

    expect(largestFluctuation?.items[0].name).toBe('下降波动')
  })
})
