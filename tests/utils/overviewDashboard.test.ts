import { describe, expect, it } from 'vitest'

import { overviewDashboardConfig } from '../../src/views/overview/constants/dashboard'
import { buildDashboardData } from '../../src/views/overview/services/dashboard'

describe('overview dashboard builder', () => {
  const unitHeaders = [
    { prop: 'unit1', label: '第一单元' },
    { prop: 'unit2', label: '第二单元' },
    { prop: 'unit3', label: '第三单元' }
  ]

  it('should build dashboard overview data', () => {
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
      config: overviewDashboardConfig
    }

    const result = buildDashboardData(options)

    expect(result.unitOverview).toHaveLength(3)
    expect(result.unitOverview[0].averageScore).toBe(79.25)
    expect(result.evaluationOverview.pendingCount).toBe(3)
    expect(result.evaluationOverview.aiConfigured).toBe(true)
  })

  it('should build focus groups and key student recommendations', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '持续低分', unit1: 55, unit2: 58, unit3: 54 },
        { xing4_ming2: '明显进步', unit1: 60, unit2: 72, unit3: 85 },
        { xing4_ming2: '波动下行', unit1: 30, unit2: 90, unit3: 60 }
      ],
      unitHeaders,
      selectedStudentNames: ['持续低分'],
      aiConfigured: false,
      config: overviewDashboardConfig
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
    const result = buildDashboardData({
      students: [{ xing4_ming2: '王五', unit1: 88, unit2: 62, unit3: 91, comment: '继续保持' }],
      unitHeaders,
      selectedStudentNames: ['王五'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    expect(result.studentTrend?.mode).toBe('single')
    expect(result.studentTrend?.students[0].name).toBe('王五')
    expect(result.studentTrend?.students[0].trendPoints).toHaveLength(3)
    expect(result.studentTrend?.students[0].completedComment).toBe(true)
    expect(result.studentTrend?.summaries.length).toBeGreaterThan(0)
  })

  it('should build compare trend summaries for multiple students', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '甲', unit1: 90, unit2: 80, unit3: 70, unit4: 60 },
        { xing4_ming2: '乙', unit1: 100, unit2: 100, unit3: 100, unit4: 70 }
      ],
      unitHeaders: [...unitHeaders, { prop: 'unit4', label: '第四单元' }],
      selectedStudentNames: ['甲', '乙'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    expect(result.studentTrend?.mode).toBe('compare')
    expect(result.studentTrend?.students.map((student) => student.name)).toEqual(['甲', '乙'])
    expect(result.studentTrend?.summaries[0]).toContain('当前对比 2 名学生')
  })

  it('should prioritize ongoing low scores in focus sections', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '最近已恢复', unit1: 40, unit2: 50, unit3: 80 },
        { xing4_ming2: '最近仍低分', unit1: 50, unit2: 80, unit3: 40 }
      ],
      unitHeaders,
      selectedStudentNames: ['最近仍低分'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const persistentLowSection = result.focusGroups
      .find((group) => group.key === 'attention')
      ?.sections.find((section) => section.key === 'persistentLowScore')

    expect(persistentLowSection?.items[0].name).toBe('最近仍低分')
  })

  it('should place downward volatility ahead of upward volatility in recommendations', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '回升波动', unit1: 60, unit2: 30, unit3: 90 },
        { xing4_ming2: '下降波动', unit1: 30, unit2: 90, unit3: 60 }
      ],
      unitHeaders,
      selectedStudentNames: ['下降波动'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const volatilityList = result.keyStudentLists.find((list) => list.key === 'volatilityWatch')

    expect(volatilityList?.items[0].name).toBe('下降波动')
    expect(result.quickStudentNames).toContain('下降波动')
  })

  it('should only flag meaningful declines instead of minor consecutive drops', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '明显下滑', unit1: 100, unit2: 97, unit3: 92 },
        { xing4_ming2: '轻微回落', unit1: 91, unit2: 90, unit3: 88 }
      ],
      unitHeaders,
      selectedStudentNames: ['明显下滑'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const decliningSection = result.focusGroups
      .find((group) => group.key === 'attention')
      ?.sections.find((section) => section.key === 'declining')

    expect(decliningSection?.items.some((item) => item.name === '明显下滑')).toBe(true)
    expect(decliningSection?.items.some((item) => item.name === '轻微回落')).toBe(false)
  })

  it('should suppress overlapping tags while keeping meaningful multi-tag risk', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '突发失常', unit1: 92, unit2: 90, unit3: 70 },
        { xing4_ming2: '低位恶化', unit1: 68, unit2: 58, unit3: 52 },
        { xing4_ming2: '临界下滑', unit1: 74, unit2: 68, unit3: 61 },
        { xing4_ming2: '平衡上升', unit1: 50, unit2: 60, unit3: 80 }
      ],
      unitHeaders,
      selectedStudentNames: ['突发失常'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const attentionGroup = result.focusGroups.find((group) => group.key === 'attention')
    const middleChangeGroup = result.focusGroups.find((group) => group.key === 'middleChange')
    const abnormalSection = attentionGroup?.sections.find((section) => section.key === 'abnormal')
    const decliningSection = attentionGroup?.sections.find((section) => section.key === 'declining')
    const persistentLowSection = attentionGroup?.sections.find((section) => section.key === 'persistentLowScore')
    const criticalSection = attentionGroup?.sections.find((section) => section.key === 'critical')
    const middleFallingSection = middleChangeGroup?.sections.find((section) => section.key === 'middleFalling')

    expect(abnormalSection?.items.some((item) => item.name === '突发失常')).toBe(true)
    expect(decliningSection?.items.some((item) => item.name === '突发失常') ?? false).toBe(false)

    expect(persistentLowSection?.items.some((item) => item.name === '低位恶化')).toBe(true)
    expect(criticalSection?.items.some((item) => item.name === '低位恶化') ?? false).toBe(false)
    expect(decliningSection?.items.some((item) => item.name === '低位恶化')).toBe(true)

    expect(criticalSection?.items.some((item) => item.name === '临界下滑')).toBe(true)
    expect(middleFallingSection?.items.some((item) => item.name === '临界下滑') ?? false).toBe(false)
  })

  it('should ignore class-wide easy exam inflation for upward change tags', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '普涨跟涨A', unit1: 70, unit2: 72, unit3: 80 },
        { xing4_ming2: '普涨跟涨B', unit1: 68, unit2: 70, unit3: 78 },
        { xing4_ming2: '真实进步', unit1: 72, unit2: 74, unit3: 90 }
      ],
      unitHeaders,
      selectedStudentNames: ['真实进步'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const encouragementGroup = result.focusGroups.find((group) => group.key === 'encouragement')
    const improvingSection = encouragementGroup?.sections.find((section) => section.key === 'improving')

    expect(improvingSection?.items.some((item) => item.name === '真实进步')).toBe(true)
    expect(improvingSection?.items.some((item) => item.name === '普涨跟涨A') ?? false).toBe(false)
    expect(improvingSection?.items.some((item) => item.name === '普涨跟涨B') ?? false).toBe(false)
  })

  it('should ignore class-wide hard exam drops for downward change tags', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '普跌跟跌A', unit1: 88, unit2: 86, unit3: 78 },
        { xing4_ming2: '普跌跟跌B', unit1: 82, unit2: 80, unit3: 72 },
        { xing4_ming2: '真实下滑', unit1: 90, unit2: 88, unit3: 70 }
      ],
      unitHeaders,
      selectedStudentNames: ['真实下滑'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const attentionGroup = result.focusGroups.find((group) => group.key === 'attention')
    const decliningSection = attentionGroup?.sections.find((section) => section.key === 'declining')

    expect(decliningSection?.items.some((item) => item.name === '真实下滑')).toBe(true)
    expect(decliningSection?.items.some((item) => item.name === '普跌跟跌A') ?? false).toBe(false)
    expect(decliningSection?.items.some((item) => item.name === '普跌跟跌B') ?? false).toBe(false)
  })

  it('should align volatility direction with difficulty-adjusted trend', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '平衡上升A', unit1: 40, unit2: 45, unit3: 70 },
        { xing4_ming2: '平衡上升B', unit1: 50, unit2: 55, unit3: 80 },
        { xing4_ming2: '波动下行', unit1: 35, unit2: 91, unit3: 32 }
      ],
      unitHeaders,
      selectedStudentNames: ['波动下行'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const volatilityGroup = result.focusGroups.find((group) => group.key === 'volatilityWatch')
    const fallingSection = volatilityGroup?.sections.find((section) => section.key === 'volatilityFalling')
    const risingSection = volatilityGroup?.sections.find((section) => section.key === 'volatilityRising')

    expect(fallingSection?.items.some((item) => item.name === '波动下行')).toBe(true)
    expect(risingSection?.items.some((item) => item.name === '波动下行') ?? false).toBe(false)
  })

  it('should classify non-monotonic rebound as volatile up', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '平衡下探A', unit1: 90, unit2: 70, unit3: 65 },
        { xing4_ming2: '平衡下探B', unit1: 88, unit2: 68, unit3: 63 },
        { xing4_ming2: '波动上行', unit1: 35, unit2: 20, unit3: 91 }
      ],
      unitHeaders,
      selectedStudentNames: ['波动上行'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const volatilityGroup = result.focusGroups.find((group) => group.key === 'volatilityWatch')
    const risingSection = volatilityGroup?.sections.find((section) => section.key === 'volatilityRising')
    const fallingSection = volatilityGroup?.sections.find((section) => section.key === 'volatilityFalling')

    expect(risingSection?.items.some((item) => item.name === '波动上行')).toBe(true)
    expect(fallingSection?.items.some((item) => item.name === '波动上行') ?? false).toBe(false)
  })

  it('should treat overall elevated rebound as volatile up even after a pullback', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '平衡基线A', unit1: 60, unit2: 62, unit3: 61 },
        { xing4_ming2: '平衡基线B', unit1: 58, unit2: 60, unit3: 59 },
        { xing4_ming2: '王铭睿', unit1: 46, unit2: 88, unit3: 69 }
      ],
      unitHeaders,
      selectedStudentNames: ['王铭睿'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const volatilityGroup = result.focusGroups.find((group) => group.key === 'volatilityWatch')
    const risingSection = volatilityGroup?.sections.find((section) => section.key === 'volatilityRising')
    const fallingSection = volatilityGroup?.sections.find((section) => section.key === 'volatilityFalling')

    expect(risingSection?.items.some((item) => item.name === '王铭睿')).toBe(true)
    expect(fallingSection?.items.some((item) => item.name === '王铭睿') ?? false).toBe(false)
  })

  it('should suppress declining when adjusted direction is volatile up', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '基线稳定A', unit1: 60, unit2: 62, unit3: 61 },
        { xing4_ming2: '基线稳定B', unit1: 58, unit2: 60, unit3: 59 },
        { xing4_ming2: '冲高回落', unit1: 35, unit2: 91, unit3: 32 }
      ],
      unitHeaders,
      selectedStudentNames: ['冲高回落'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const attentionGroup = result.focusGroups.find((group) => group.key === 'attention')
    const volatilityGroup = result.focusGroups.find((group) => group.key === 'volatilityWatch')
    const decliningSection = attentionGroup?.sections.find((section) => section.key === 'declining')
    const risingSection = volatilityGroup?.sections.find((section) => section.key === 'volatilityRising')

    expect(risingSection?.items.some((item) => item.name === '冲高回落')).toBe(true)
    expect(decliningSection?.items.some((item) => item.name === '冲高回落') ?? false).toBe(false)
  })

  it('should attach difficulty hints to the corresponding trend score segment', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '基线A', unit1: 60, unit2: 62, unit3: 61 },
        { xing4_ming2: '基线B', unit1: 58, unit2: 60, unit3: 59 },
        { xing4_ming2: '颜色样例', unit1: 35, unit2: 91, unit3: 32 }
      ],
      unitHeaders,
      selectedStudentNames: ['颜色样例'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const volatilityGroup = result.focusGroups.find((group) => group.key === 'volatilityWatch')
    const targetItem = volatilityGroup?.sections
      .flatMap((section) => section.items)
      .find((item) => item.name === '颜色样例')

    expect(targetItem?.trendSegments.map((segment) => [segment.text, segment.difficultyShift])).toEqual([
      ['35', 'normal'],
      [' → ', 'normal'],
      ['91', 'easy'],
      [' → ', 'normal'],
      ['32', 'hard']
    ])
  })

  it('should not classify mid-high fluctuation as low recovery', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '历史低位样本', unit1: 42, unit2: 55, unit3: 75, unit4: 86, unit5: 83 }
      ],
      unitHeaders: [
        ...unitHeaders,
        { prop: 'unit4', label: '第四单元' },
        { prop: 'unit5', label: '第五单元' }
      ],
      selectedStudentNames: ['历史低位样本'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const encouragementGroup = result.focusGroups.find((group) => group.key === 'encouragement')
    const lowRecoverySection = encouragementGroup?.sections.find((section) => section.key === 'lowRecovery')

    expect(lowRecoverySection?.items.some((item) => item.name === '历史低位样本') ?? false).toBe(false)
  })

  it('should not keep improving after a visible pullback', () => {
    const result = buildDashboardData({
      students: [
        { xing4_ming2: '回落样本A', unit1: 60, unit2: 62, unit3: 61 },
        { xing4_ming2: '回落样本B', unit1: 58, unit2: 60, unit3: 59 },
        { xing4_ming2: '先升后回落', unit1: 44, unit2: 88, unit3: 69 }
      ],
      unitHeaders,
      selectedStudentNames: ['先升后回落'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })

    const encouragementGroup = result.focusGroups.find((group) => group.key === 'encouragement')
    const improvingSection = encouragementGroup?.sections.find((section) => section.key === 'improving')

    expect(improvingSection?.items.some((item) => item.name === '先升后回落') ?? false).toBe(false)
  })
})
