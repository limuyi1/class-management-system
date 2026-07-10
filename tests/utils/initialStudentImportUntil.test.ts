import { describe, expect, it } from 'vitest'

import { buildInitialStudentImport } from '../../src/utils/initialStudentImportUntil'
import { NAME_PROP } from '../../src/types/Constants'

describe('initialStudentImportUntil', () => {
  it('imports names, selected scores and non-empty comments', () => {
    const result = buildInitialStudentImport({
      rows: [
        { 学生: '张三', 数学: '96', 期末评语: ' 表现认真 ' },
        { 学生: '李四', 数学: '88', 期末评语: '' },
        { 学生: '', 数学: '70', 期末评语: '忽略' }
      ],
      nameColumn: '学生',
      scoreColumns: ['数学'],
      commentColumn: '期末评语'
    })

    expect(result.students).toHaveLength(2)
    expect(result.students[0]).toMatchObject({ [NAME_PROP]: '张三', comment: '表现认真' })
    expect(result.students[0].studentId).toBeTruthy()
    expect(result.students[1].studentId).not.toBe(result.students[0].studentId)
    expect(result.students[1].comment).toBeUndefined()
    expect(result.commentCount).toBe(1)
  })

  it('supports importing a name list without scores or comments', () => {
    const result = buildInitialStudentImport({
      rows: [{ 姓名: '张三' }, { 姓名: '李四' }],
      nameColumn: '姓名',
      scoreColumns: []
    })

    expect(result.students.map((student) => student[NAME_PROP])).toEqual(['张三', '李四'])
    expect(result.students.every((student) => Boolean(student.studentId))).toBe(true)
    expect(result.headers).toEqual([])
    expect(result.commentCount).toBe(0)
  })
})
