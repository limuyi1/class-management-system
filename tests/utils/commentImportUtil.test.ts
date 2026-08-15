import { describe, expect, it } from 'vitest'

import {
  buildIncrementalCommentImport,
  countOverwrittenComments
} from '../../src/utils/commentImportUtil'
import { NAME_PROP } from '../../src/constants'

const students = [
  { studentId: 'student-1', [NAME_PROP]: '张三', comment: '原评语' },
  { studentId: 'student-2', [NAME_PROP]: '李四' }
]

describe('commentImportUtil', () => {
  it('fills only empty comments by default', () => {
    const result = buildIncrementalCommentImport({
      rows: [
        { 学生姓名: '张三', 评语: '新评语' },
        { 学生姓名: '李四', 评语: '新增评语' },
        { 学生姓名: '王五', 评语: '未匹配' }
      ],
      existingStudents: students,
      nameColumn: '学生姓名',
      commentColumn: '评语',
      strategy: 'fill-empty'
    })

    expect(result.students[0].comment).toBe('原评语')
    expect(result.students[1].comment).toBe('新增评语')
    expect(result.stats).toMatchObject({
      matchedStudentCount: 2,
      filledCommentCount: 1,
      overwrittenCommentCount: 0,
      ignoredStudentCount: 1
    })
  })

  it('overwrites existing comments but never uses blank Excel cells', () => {
    const result = buildIncrementalCommentImport({
      rows: [
        { 姓名: '张三', 评语: '润色后评语' },
        { 姓名: '李四', 评语: '  ' }
      ],
      existingStudents: students,
      nameColumn: '姓名',
      commentColumn: '评语',
      strategy: 'overwrite'
    })

    expect(result.students[0].comment).toBe('润色后评语')
    expect(result.students[1].comment).toBeUndefined()
    expect(result.stats.overwrittenCommentCount).toBe(1)
    expect(result.stats.skippedCommentCount).toBe(1)
  })

  it('keeps the current student-table order when Excel rows use a different order', () => {
    const result = buildIncrementalCommentImport({
      rows: [
        { 姓名: '李四', 评语: '李四的新评语' },
        { 姓名: '张三', 评语: '张三的新评语' }
      ],
      existingStudents: students,
      nameColumn: '姓名',
      commentColumn: '评语',
      strategy: 'overwrite'
    })

    expect(result.students.map((student) => student[NAME_PROP])).toEqual(['张三', '李四'])
    expect(result.students.map((student) => student.comment)).toEqual([
      '张三的新评语',
      '李四的新评语'
    ])
  })

  it('counts comments that require overwrite confirmation', () => {
    expect(
      countOverwrittenComments({
        rows: [
          { 姓名: '张三', 评语: '新评语' },
          { 姓名: '李四', 评语: '新增评语' }
        ],
        existingStudents: students,
        nameColumn: '姓名',
        commentColumn: '评语',
        strategy: 'overwrite'
      })
    ).toBe(1)
  })

  it('skips duplicate Excel names and continues importing unique names', () => {
    const result = buildIncrementalCommentImport({
      rows: [
        { 姓名: '张三', 评语: '第一条' },
        { 姓名: '张三', 评语: '第二条' },
        { 姓名: '李四', 评语: '李四评语' }
      ],
      existingStudents: students,
      nameColumn: '姓名',
      commentColumn: '评语',
      strategy: 'overwrite'
    })

    expect(result.students[0].comment).toBe('原评语')
    expect(result.students[1].comment).toBe('李四评语')
    expect(result.stats.duplicateStudentCount).toBe(2)
  })
})
