import { describe, expect, it } from 'vitest'

import {
  applyPolishedComments,
  buildCommentPolishTargets
} from '../../src/utils/commentPolishUntil'
import { NAME_PROP } from '../../src/types/Constants'

describe('commentPolishUntil', () => {
  it('builds polish targets only from students with existing comments', () => {
    const targets = buildCommentPolishTargets(
      [
        { studentId: 'student-1', [NAME_PROP]: '张三', comment: ' 表现认真 ' },
        { studentId: 'student-2', [NAME_PROP]: '李四', comment: ' ' },
        { studentId: 'student-3', [NAME_PROP]: '王五' }
      ],
      (student) => `标签-${student[NAME_PROP]}`
    )

    expect(targets).toEqual([
      {
        studentId: 'student-1',
        name: '张三',
        comment: '表现认真',
        tags: '标签-张三'
      }
    ])
  })

  it('applies only non-empty polished comments and never fills blank originals', () => {
    const students = [
      { studentId: 'student-1', [NAME_PROP]: '张三', comment: '原评语' },
      { studentId: 'student-2', [NAME_PROP]: '李四', comment: '' },
      { studentId: 'student-3', [NAME_PROP]: '王五', comment: '保留评语' }
    ]

    const updatedCount = applyPolishedComments(students, [
      { studentId: 'student-1', name: '已改名也不影响', comment: ' 润色后评语 ' },
      { studentId: 'student-2', name: '李四', comment: '不应写入' },
      { studentId: 'student-3', name: '王五', comment: '   ' }
    ])

    expect(updatedCount).toBe(1)
    expect(students[0].comment).toBe('润色后评语')
    expect(students[1].comment).toBe('')
    expect(students[2].comment).toBe('保留评语')
  })
})
