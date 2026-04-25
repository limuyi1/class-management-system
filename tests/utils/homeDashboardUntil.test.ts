import { describe, expect, it } from 'vitest'

import { homeDashboardConfig } from '../../src/config/home-dashboard'
import { buildHomeDashboardData } from '../../src/utils/homeDashboardUntil'
import { buildDashboardData } from '../../src/views/overview/services/dashboard'

describe('homeDashboardUntil', () => {
  const unitHeaders = [
    { prop: 'unit1', label: '第一单元' },
    { prop: 'unit2', label: '第二单元' },
    { prop: 'unit3', label: '第三单元' }
  ]

  it('should keep compatibility wrapper aligned with the new dashboard builder', () => {
    const options = {
      students: [
        { xing4_ming2: '张三', unit1: 92, unit2: 95, unit3: 93, comment: '表现稳定' },
        { xing4_ming2: '李四', unit1: 55, unit2: 58, unit3: 54, comment: '' },
        { xing4_ming2: '王五', unit1: 88, unit2: 62, unit3: 91 },
        { xing4_ming2: '赵六', unit1: 82, unit2: 74, unit3: 60 }
      ],
      unitHeaders,
      selectedStudentNames: ['张三'],
      aiConfigured: true,
      config: homeDashboardConfig
    }

    const legacyResult = buildHomeDashboardData(options)
    const newResult = buildDashboardData(options)

    expect(legacyResult).toEqual(newResult)
    expect(newResult.unitOverview).toHaveLength(3)
    expect(newResult.unitOverview[0].averageScore).toBe(79.25)
    expect(newResult.evaluationOverview.pendingCount).toBe(3)
    expect(newResult.evaluationOverview.aiConfigured).toBe(true)
  })

  it('should build focus groups and key student recommendations', () => {
    const result = buildHomeDashboardData({
      students: [
        { xing4_ming2: '持续低分', unit1: 55, unit2: 58, unit3: 54 },
        { xing4_ming2: '明显进步', unit1: 60, unit2: 72, unit3: 85 },
        { xing4_ming2: '波动下行', unit1: 30, unit2: 90, unit3: 60 }
      ],
      unitHeaders,
      selectedStudentNames: ['持续低分'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    const attentionGroup = result.focusGroups.find((group) => group.key === 'attention')
    const encouragementGroup = result.focusGroups.find((group) => group.key === 'encouragement')
    const volatilityList = result.keyStudentLists.find((list) => list.key === 'volatilityWatch')

    expect(attentionGroup?.sections.some((section) => section.key === 'persistentLowScore')).toBe(true)
    expect(
      attentionGroup?.sections
        .find((section) => section.key === 'persistentLowScore')
        ?.items.some((item) => item.name === '持续低分')
    ).toBe(true)
    expect(encouragementGroup?.sections.some((section) => section.key === 'improving')).toBe(true)
    expect(volatilityList?.items[0].name).toBe('波动下行')
  })

  it('should build single student trend summaries', () => {
    const result = buildHomeDashboardData({
      students: [{ xing4_ming2: '王五', unit1: 88, unit2: 62, unit3: 91, comment: '继续保持' }],
      unitHeaders,
      selectedStudentNames: ['王五'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    expect(result.studentTrend?.mode).toBe('single')
    expect(result.studentTrend?.students[0].name).toBe('王五')
    expect(result.studentTrend?.students[0].trendPoints).toHaveLength(3)
    expect(result.studentTrend?.students[0].completedComment).toBe(true)
    expect(result.studentTrend?.summaries.length).toBeGreaterThan(0)
  })

  it('should build compare trend summaries for multiple students', () => {
    const result = buildHomeDashboardData({
      students: [
        { xing4_ming2: '甲', unit1: 90, unit2: 80, unit3: 70, unit4: 60 },
        { xing4_ming2: '乙', unit1: 100, unit2: 100, unit3: 100, unit4: 70 }
      ],
      unitHeaders: [...unitHeaders, { prop: 'unit4', label: '第四单元' }],
      selectedStudentNames: ['甲', '乙'],
      aiConfigured: false,
      config: homeDashboardConfig
    })

    expect(result.studentTrend?.mode).toBe('compare')
    expect(result.studentTrend?.students.map((student) => student.name)).toEqual(['甲', '乙'])
    expect(result.studentTrend?.summaries[0]).toContain('当前对比 2 名学生')
  })

  it('should prioritize ongoing low scores in focus sections', () => {
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

    const persistentLowSection = result.focusGroups
      .find((group) => group.key === 'attention')
      ?.sections.find((section) => section.key === 'persistentLowScore')

    expect(persistentLowSection?.items[0].name).toBe('最近仍低分')
  })

  it('should place downward volatility ahead of upward volatility in recommendations', () => {
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

    const volatilityList = result.keyStudentLists.find((list) => list.key === 'volatilityWatch')

    expect(volatilityList?.items[0].name).toBe('下降波动')
    expect(result.quickStudentNames).toContain('下降波动')
  })
})
