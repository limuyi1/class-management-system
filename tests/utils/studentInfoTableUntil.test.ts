import { describe, expect, it } from 'vitest'

import {
  buildStudentInfoTagSummaryMap,
  getStudentInfoTagSummary
} from '../../src/views/student-info/utils/studentInfoTableUntil'

import type { StudentDataType } from '../../src/types/StudentData'

describe('studentInfoTableUntil', () => {
  it('builds stable visible tag summaries and limits rendered tags', () => {
    const students: StudentDataType[] = [
      {
        studentId: 'student-1',
        xing4_ming2: '张三',
        tags: {
          strength: ['认真', '积极'],
          habit: ['守时', '整洁']
        }
      }
    ]

    const summaryMap = buildStudentInfoTagSummaryMap(
      students,
      [
        { prop: 'strength', label: '优点' },
        { prop: 'habit', label: '习惯' }
      ],
      3
    )
    const summary = getStudentInfoTagSummary(summaryMap, 'student-1')

    expect(summary.visibleTags).toEqual([
      { key: 'strength:认真', label: '认真', color: 'var(--theme-tag-1)' },
      { key: 'strength:积极', label: '积极', color: 'var(--theme-tag-1)' },
      { key: 'habit:守时', label: '守时', color: 'var(--theme-tag-2)' }
    ])
    expect(summary.hiddenCount).toBe(1)
  })

  it('returns an empty summary for students without cached tags', () => {
    expect(getStudentInfoTagSummary(new Map(), 'missing')).toEqual({
      visibleTags: [],
      hiddenCount: 0
    })
  })
})
