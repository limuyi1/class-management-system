import { describe, expect, it } from 'vitest'

import { buildExamPrintAnalysis } from '../../src/utils/examPrintUtil'

describe('本期测评打印统计', () => {
  it('不同满分按比例分段，零分有效，空值不算零，转出学生不计入', () => {
    const result = buildExamPrintAnalysis(
      [
        { studentId: 'a', name: '甲', score: 120, history: 100 },
        { studentId: 'b', name: '乙', score: 0 },
        { studentId: 'c', name: '丙', score: null },
        { studentId: 'd', name: '丁', score: 200, departed: true }
      ],
      'score',
      200
    )
    expect(result).toMatchObject({
      total: 3,
      valid: 2,
      missing: 1,
      average: 60,
      passRate: 50,
      excellentRate: 0
    })
    expect(result.bands.reduce((sum, band) => sum + band.count, 0)).toBe(2)
  })
  it('空班级显示空统计，非法值不污染均分', () => {
    expect(buildExamPrintAnalysis([], 'score', 100).average).toBeNull()
    expect(
      buildExamPrintAnalysis([{ studentId: 'a', name: '甲', score: -2 }], 'score', 100).valid
    ).toBe(0)
  })
})
