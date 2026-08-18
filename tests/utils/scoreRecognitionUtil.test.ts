import { describe, expect, it } from 'vitest'

import {
  buildScoreRecognitionPreview,
  isValidScore
} from '../../src/utils/scoreRecognitionUtil'
import { NAME_PROP } from '../../src/constants'
import type { StudentDataType } from '../../src/types/StudentData'

describe('scoreRecognitionUtil', () => {
  it('validates scores within 0 ~ fullMark', () => {
    expect(isValidScore(95, 100)).toBe(true)
    expect(isValidScore(0, 100)).toBe(true)
    expect(isValidScore(100, 100)).toBe(true)
    expect(isValidScore(150, 100)).toBe(false)
    expect(isValidScore(-1, 100)).toBe(false)
    expect(isValidScore(null, 100)).toBe(false)
    expect(isValidScore(undefined, 100)).toBe(false)
    expect(isValidScore(NaN, 100)).toBe(false)
  })

  it('respects a custom fullMark', () => {
    expect(isValidScore(120, 150)).toBe(true)
    expect(isValidScore(151, 150)).toBe(false)

    const students: StudentDataType[] = [{ studentId: 'student-1', [NAME_PROP]: '张三' }]
    const rows = buildScoreRecognitionPreview(
      [{ name: '张三', score: 120 }],
      students,
      'shu4_xue2',
      150
    )
    expect(rows[0].valid).toBe(true)
  })

  it('builds preview rows for uniquely matched students', () => {
    const students: StudentDataType[] = [
      { studentId: 'student-1', [NAME_PROP]: '张三', shu4_xue2: 90 },
      { studentId: 'student-2', [NAME_PROP]: '李四', shu4_xue2: 80 }
    ]

    const rows = buildScoreRecognitionPreview(
      [
        { name: '张三', score: 95 },
        { name: '李四', score: 88 }
      ],
      students,
      'shu4_xue2',
      100
    )

    expect(rows[0]).toMatchObject({
      name: '张三',
      studentId: 'student-1',
      matched: true,
      score: 95,
      valid: true,
      existingScore: 90,
      willOverwrite: true
    })
    expect(rows[1]).toMatchObject({
      name: '李四',
      studentId: 'student-2',
      matched: true,
      score: 88,
      valid: true,
      existingScore: 80,
      willOverwrite: true
    })
  })

  it('marks duplicate names as unmatched', () => {
    const students: StudentDataType[] = [
      { studentId: 'student-1', [NAME_PROP]: '张三' },
      { studentId: 'student-2', [NAME_PROP]: '张三' }
    ]

    const rows = buildScoreRecognitionPreview(
      [{ name: '张三', score: 90 }],
      students,
      'shu4_xue2',
      100
    )

    expect(rows[0]).toMatchObject({ matched: false, studentId: null })
  })

  it('marks unknown names as unmatched', () => {
    const students: StudentDataType[] = [{ studentId: 'student-2', [NAME_PROP]: '李四' }]

    const rows = buildScoreRecognitionPreview(
      [{ name: '王五', score: 90 }],
      students,
      'shu4_xue2',
      100
    )

    expect(rows[0]).toMatchObject({ matched: false, studentId: null })
  })

  it('marks out-of-range scores as invalid', () => {
    const students: StudentDataType[] = [{ studentId: 'student-1', [NAME_PROP]: '张三' }]

    const rows = buildScoreRecognitionPreview(
      [
        { name: '张三', score: 120 },
        { name: '张三', score: -5 }
      ],
      students,
      'shu4_xue2',
      100
    )

    expect(rows[0].valid).toBe(false)
    expect(rows[1].valid).toBe(false)
  })

  it('handles null score and missing existing score', () => {
    const students: StudentDataType[] = [{ studentId: 'student-1', [NAME_PROP]: '张三' }]

    const rows = buildScoreRecognitionPreview(
      [{ name: '张三', score: null }],
      students,
      'shu4_xue2',
      100
    )

    expect(rows[0]).toMatchObject({
      matched: true,
      score: null,
      valid: false,
      existingScore: null,
      willOverwrite: false
    })
  })
})
