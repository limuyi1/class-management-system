import { describe, expect, it } from 'vitest'

import { NAME_PROP } from '../../src/types/Constants'
import { buildStudentReportData } from '../../src/utils/studentReportUntil'

describe('studentReportUntil', () => {
  it('keeps empty-score units in score items and excludes them from summary stats', () => {
    const report = buildStudentReportData({
      student: {
        [NAME_PROP]: '张三',
        unit1: 88,
        unit2: null,
        unit3: 92
      },
      students: [
        { [NAME_PROP]: '张三', unit1: 88, unit2: null, unit3: 92 },
        { [NAME_PROP]: '李四', unit1: 78, unit2: 86, unit3: 82 }
      ],
      scoreColumns: [
        { prop: 'unit1', label: '第一单元' },
        { prop: 'unit2', label: '第二单元' },
        { prop: 'unit3', label: '第三单元' }
      ],
      selectedProps: ['unit1', 'unit2', 'unit3'],
      tagCategories: []
    })

    expect(report.scoreItems).toMatchObject([
      { label: '第一单元', score: 88, rank: 1, delta: null },
      { label: '第二单元', score: null, rank: null, delta: null },
      { label: '第三单元', score: 92, rank: 1, delta: 4 }
    ])
    expect(report.summary.averageScore).toBe(90)
    expect(report.summary.highestScore).toBe(92)
    expect(report.summary.lowestScore).toBe(88)
  })
})
