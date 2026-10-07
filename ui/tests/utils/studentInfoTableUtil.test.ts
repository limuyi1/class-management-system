/**
 * 测试 studentInfoTableUtil 模块。
 * 覆盖：学生信息表中标签摘要映射的构建与读取、可见标签数量上限，
 * 以及无缓存标签时的空摘要回退。
 */
import { describe, expect, it } from 'vitest'

import {
  buildStudentInfoTagSummaryMap,
  getStudentInfoTagSummary,
  insertStudentAtSequence,
  moveStudentToSequence
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

  it('moves a student by sequence without changing its associated data', () => {
    const target: StudentDataType = {
      studentId: 'student-2',
      name: '李四',
      math: 96,
      comment: '保持原评语',
      tags: { strength: ['认真'] }
    }
    const students: StudentDataType[] = [
      { studentId: 'student-1', name: '张三' },
      target,
      { studentId: 'student-3', name: '王五' }
    ]

    expect(moveStudentToSequence(students, 'student-2', 3)).toBe(true)
    expect(students.map((student) => student.studentId)).toEqual([
      'student-1',
      'student-3',
      'student-2'
    ])
    expect(students[2]).toBe(target)
    expect(students[2]).toMatchObject({ math: 96, comment: '保持原评语' })
  })

  it('inserts a new student at an occupied sequence and shifts existing students back', () => {
    const students: StudentDataType[] = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四' },
      { studentId: 'student-3', name: '王五' }
    ]

    insertStudentAtSequence(students, { studentId: 'student-new', name: '赵六' }, 2)

    expect(students.map((student) => student.studentId)).toEqual([
      'student-1',
      'student-new',
      'student-2',
      'student-3'
    ])
  })

  it('moves a student forward and shifts the occupied range back', () => {
    const students: StudentDataType[] = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四' },
      { studentId: 'student-3', name: '王五' },
      { studentId: 'student-4', name: '赵六' }
    ]

    moveStudentToSequence(students, 'student-4', 2)

    expect(students.map((student) => student.studentId)).toEqual([
      'student-1',
      'student-4',
      'student-2',
      'student-3'
    ])
  })
})
