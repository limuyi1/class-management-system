/**
 * 测试 studentInfoTableUtil 模块。
 * 覆盖：学生信息表中标签摘要映射的构建与读取、可见标签数量上限，
 * 以及无缓存标签时的空摘要回退。
 */
import { describe, expect, it } from 'vitest'

import {
  buildStudentInfoTagSummaryMap,
  getStudentInfoTagSummary
} from '../../src/views/student-info/utils/studentInfoTableUtil'

import type { StudentDataType } from '../../src/types/StudentData'

// 学生信息表工具函数测试组
describe('studentInfoTableUtil', () => {
  it('builds stable visible tag summaries and limits rendered tags', () => {
    // 学生数据带两分类四标签，可见上限为 3，超出部分计入 hiddenCount
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
