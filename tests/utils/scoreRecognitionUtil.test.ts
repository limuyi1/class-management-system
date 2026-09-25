/**
 * 测试 scoreRecognitionUtil 模块。
 * 覆盖：成绩是否落在 0~满分区间内的校验、按姓名匹配学生构建识别预览行，
 * 以及重名、未知姓名、超范围分数与空分数等边界场景。
 */
import { describe, expect, it } from 'vitest'

import {
  buildScoreRecognitionPreview,
  getIgnoredScoreRecognitionNames,
  isValidScore
} from '../../src/utils/scoreRecognitionUtil'
import { NAME_PROP } from '../../src/constants'
import type { StudentDataType } from '../../src/types/StudentData'

// 成绩识别工具函数测试组
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

  it('leaves duplicate roster names unselected for manual review', () => {
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

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ source: 'missing', studentId: 'student-1' })
    expect(rows[1]).toMatchObject({ source: 'missing', studentId: 'student-2' })
  })

  it('omits names outside the roster from preview rows', () => {
    const students: StudentDataType[] = [{ studentId: 'student-2', [NAME_PROP]: '李四' }]

    const rows = buildScoreRecognitionPreview(
      [{ name: '王五', score: 90 }],
      students,
      'shu4_xue2',
      100
    )

    expect(rows[0]).toMatchObject({ source: 'missing', studentId: 'student-2', name: '李四' })
    expect(rows).toHaveLength(1)
    expect(getIgnoredScoreRecognitionNames([{ name: '王五', score: 90 }], students)).toEqual([
      '王五'
    ])
  })

  it('shows unrecognized roster students and excludes disabled students', () => {
    const students: StudentDataType[] = [
      { studentId: 'student-1', [NAME_PROP]: '黄邓魁', shu4_xue2: 75 },
      { studentId: 'student-2', [NAME_PROP]: '吴承宇', disabled: true }
    ]

    const rows = buildScoreRecognitionPreview(
      [{ name: '吴承宇', score: 90 }],
      students,
      'shu4_xue2',
      100
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'missing',
      name: '黄邓魁',
      studentId: 'student-1',
      score: null,
      existingScore: 75
    })
    expect(getIgnoredScoreRecognitionNames([{ name: '吴承宇', score: 90 }], students)).toEqual([
      '吴承宇'
    ])
  })

  it('does not auto-match repeated AI names to one student', () => {
    const students: StudentDataType[] = [{ studentId: 'student-1', [NAME_PROP]: '张三' }]
    const rows = buildScoreRecognitionPreview(
      [{ name: '张三', score: 90 }, { name: '张三', score: 95 }],
      students,
      'shu4_xue2',
      100
    )
    expect(rows.map((row) => row.source)).toEqual(['missing'])
    expect(getIgnoredScoreRecognitionNames(
      [{ name: '张三', score: 90 }, { name: '张三', score: 95 }], students
    )).toEqual([])
  })

  it('places a roster-assisted name correction in a review-only row', () => {
    const students: StudentDataType[] = [
      { studentId: 'student-1', [NAME_PROP]: '黄邓魁', shu4_xue2: 75 }
    ]
    const rows = buildScoreRecognitionPreview(
      [{ name: '黄邓魁', rawName: '吴承宇', score: 88 }],
      students,
      'shu4_xue2',
      100
    )

    expect(rows[0]).toMatchObject({
      source: 'suggested',
      matched: false,
      rawName: '吴承宇',
      studentId: 'student-1',
      score: 88,
      willOverwrite: true
    })
    expect(getIgnoredScoreRecognitionNames(
      [{ name: '黄邓魁', rawName: '吴承宇', score: 88 }], students
    )).toEqual([])
  })

  it('does not assign two suggested scores to one student', () => {
    const students: StudentDataType[] = [{ studentId: 'student-1', [NAME_PROP]: '黄邓魁' }]
    const rows = buildScoreRecognitionPreview(
      [
        { name: '黄邓魁', rawName: '吴承宇', score: 88 },
        { name: '黄邓魁', rawName: '黄邓魁', score: 91 }
      ],
      students,
      'shu4_xue2',
      100
    )
    expect(rows[0]).toMatchObject({ source: 'missing', score: null })
  })

  it('does not auto-select when the model explicitly declines to match a visible name', () => {
    const students: StudentDataType[] = [{ studentId: 'student-1', [NAME_PROP]: '黄邓魁' }]
    const rows = buildScoreRecognitionPreview(
      [{ name: '黄邓魁', rawName: '黄邓魁', matchedName: null, score: 88 }],
      students,
      'shu4_xue2',
      100
    )
    expect(rows[0]).toMatchObject({ source: 'suggested', matched: false, score: 88 })
  })

  it('marks out-of-range scores as invalid', () => {
    const students: StudentDataType[] = [{ studentId: 'student-1', [NAME_PROP]: '张三' }]

    for (const score of [120, -5]) {
      const rows = buildScoreRecognitionPreview(
        [{ name: '张三', score }],
        students,
        'shu4_xue2',
        100
      )
      expect(rows[0].valid).toBe(false)
    }
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
