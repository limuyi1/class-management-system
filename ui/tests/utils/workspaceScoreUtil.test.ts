import { describe, expect, it } from 'vitest'

import {
  buildWorkspaceScoreProjection,
  normalizeWorkspaceScore
} from '../../src/utils/workspaceScoreUtil'
import { buildDashboardData } from '../../src/views/overview/services/dashboard'
import { overviewDashboardConfig } from '../../src/views/overview/constants/dashboard'

import type { WorkspaceCatalogType, WorkspaceSnapshotType } from '../../src/types/Workspace'

const catalog: WorkspaceCatalogType = {
  id: 'main',
  activePeriodId: 'new',
  revision: 'r',
  migrationReviewed: true,
  updatedAt: '',
  classes: [{ id: 'class', lastPeriodId: 'new' }],
  periods: [
    {
      id: 'old',
      classId: 'class',
      className: '303',
      termName: '去年',
      createdAt: '',
      references: []
    },
    {
      id: 'new',
      classId: 'class',
      className: '403',
      termName: '今年',
      createdAt: '',
      references: [{ periodId: 'old', prop: 'final' }]
    }
  ]
}
const snapshot: WorkspaceSnapshotType = {
  id: 'old',
  updatedAt: '',
  preferences: { inputScoreTab: null, recentScoreEntries: {}, scoreFullMark: 120 },
  setting: {
    id: 'main',
    updatedAt: '',
    scoreColumns: [{ prop: 'final', label: '期末', disabled: false }],
    tagCategories: [],
    tags: {}
  },
  students: [
    { studentId: 'a', name: '同名', final: 96 },
    { studentId: 'b', name: '已转出', final: 108, departed: true },
    { studentId: 'c', name: '同名', final: 72 }
  ]
}
const headers = [
  { prop: 'unit1', label: '第一单元', disabled: false },
  { prop: 'unit2', label: '第二单元', disabled: false }
]
const students = [
  { studentId: 'a', name: '同名', unit1: 80, unit2: 82 },
  { studentId: 'new-student', name: '同名', unit1: 70, unit2: 75 }
]

describe('workspace score projection', () => {
  it('links by ID, preserves original score and original cohort ranks, does not fill missing history', () => {
    const projection = buildWorkspaceScoreProjection(catalog, [snapshot], students, headers, 100)
    const prop = projection.referenceHeaders[0].prop
    expect(projection.rawStudents[0][prop]).toBe(96)
    expect(projection.normalizedStudents[0][prop]).toBe(80)
    expect(projection.rawStudents[1][prop]).toBeNull()
    expect(projection.rankByProp.get(prop)?.get('a')).toBe(2)
    expect(projection.referenceScores.get(prop)).toEqual([80, 90, 60])
    expect(students[0]).not.toHaveProperty(prop)
    expect(projection.referenceHeaders[0].label).toContain('303 · 去年 · 期末')
  })

  it('counts only current columns in KPI but includes history in individual trends', () => {
    const projection = buildWorkspaceScoreProjection(catalog, [snapshot], students, headers, 100)
    const data = buildDashboardData({
      students: projection.normalizedStudents,
      unitHeaders: headers,
      trendStudents: projection.normalizedStudents,
      trendHeaders: projection.normalizedHeaders,
      rankByProp: projection.rankByProp,
      selectedStudentIds: ['a', 'new-student'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })
    expect(data.kpi.completedUnitCount).toBe(2)
    expect(data.kpi.totalUnitCount).toBe(2)
    expect(data.unitOverview).toHaveLength(2)
    expect(data.kpi.averageScore).toBe(76.8)
    expect(
      data.studentTrend?.students.find((student) => student.studentId === 'a')?.scoreCount
    ).toBe(3)
    expect(
      data.studentTrend?.students.find((student) => student.studentId === 'new-student')?.scoreCount
    ).toBe(2)
  })

  it('does not infer current status from history alone or normalize difficulty across the term boundary', () => {
    const projection = buildWorkspaceScoreProjection(
      catalog,
      [snapshot],
      [{ studentId: 'a', name: '同名' }],
      headers,
      100
    )
    const data = buildDashboardData({
      students: projection.normalizedStudents,
      unitHeaders: headers,
      trendStudents: projection.normalizedStudents,
      trendHeaders: projection.normalizedHeaders,
      selectedStudentIds: ['a'],
      aiConfigured: false,
      config: overviewDashboardConfig
    })
    expect(data.studentTrend).toBeNull()
    expect(data.kpi.completedUnitCount).toBe(0)
  })

  it('exposes broken references and does not count them as scores', () => {
    const projection = buildWorkspaceScoreProjection(catalog, [], students, headers, 100)
    expect(projection.missingReferences).toBe(1)
    expect(projection.referenceHeaders).toHaveLength(0)
    expect(projection.normalizedHeaders).toHaveLength(2)
  })

  it('uses each column full mark and preserves zero as a valid score', () => {
    const projection = buildWorkspaceScoreProjection(
      null,
      [],
      [{ studentId: 'a', name: '甲', unit1: 45, unit2: 0 }],
      [{ ...headers[0], fullMark: 50 }, headers[1]],
      100
    )
    expect(projection.normalizedStudents[0].unit1).toBe(90)
    expect(projection.normalizedStudents[0].unit2).toBe(0)
    expect(normalizeWorkspaceScore(null, 100)).toBeNull()
    expect(normalizeWorkspaceScore(90, 0)).toBeNull()
  })
})
