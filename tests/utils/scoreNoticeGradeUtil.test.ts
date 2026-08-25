/**
 * 测试 scoreNoticeGradeUtil 模块。
 * 覆盖：等第值归一化（全角/带“等”字后缀）、百分制与五十分制的边界换算、
 * 来源模式识别以及按科目推荐默认规则。
 */
import { describe, expect, it } from 'vitest'

import { ScoreNoticeModeEnum } from '../../src/types/ScoreNotice'
import {
  DEFAULT_100_SCORE_RULE,
  DEFAULT_50_SCORE_RULE,
  convertScoreToGrade,
  detectScoreNoticeMode,
  getDefaultGradeRule,
  normalizeGradeValue
} from '../../src/utils/score-notice/scoreNoticeGradeUtil'

// 成绩通知等第工具函数测试组
describe('scoreNoticeGradeUtil', () => {
  it('normalizes common grade values', () => {
    expect(normalizeGradeValue(' A等 ')).toBe('A')
    expect(normalizeGradeValue('b')).toBe('B')
    expect(normalizeGradeValue('C等级')).toBe('C')
    expect(normalizeGradeValue('优秀')).toBeNull()
  })

  it('converts 100-point score boundaries without overlap', () => {
    expect(convertScoreToGrade(100, DEFAULT_100_SCORE_RULE)).toBe('A')
    expect(convertScoreToGrade(80, DEFAULT_100_SCORE_RULE)).toBe('A')
    expect(convertScoreToGrade(79.9, DEFAULT_100_SCORE_RULE)).toBe('B')
    expect(convertScoreToGrade(60, DEFAULT_100_SCORE_RULE)).toBe('B')
    expect(convertScoreToGrade(59.9, DEFAULT_100_SCORE_RULE)).toBe('C')
  })

  it('converts 50-point score boundaries without overlap', () => {
    expect(convertScoreToGrade(50, DEFAULT_50_SCORE_RULE)).toBe('A')
    expect(convertScoreToGrade(40, DEFAULT_50_SCORE_RULE)).toBe('A')
    expect(convertScoreToGrade(39.9, DEFAULT_50_SCORE_RULE)).toBe('B')
    expect(convertScoreToGrade(30, DEFAULT_50_SCORE_RULE)).toBe('B')
    expect(convertScoreToGrade(29.9, DEFAULT_50_SCORE_RULE)).toBe('C')
  })

  it('detects source mode and recommends subject rules', () => {
    expect(detectScoreNoticeMode(['A', 'B等', 'C'])).toBe(ScoreNoticeModeEnum.Grade)
    expect(detectScoreNoticeMode([96, 72, 55])).toBe(ScoreNoticeModeEnum.Score)
    expect(getDefaultGradeRule('科学')).toEqual(DEFAULT_50_SCORE_RULE)
    expect(getDefaultGradeRule('体育')).toEqual(DEFAULT_100_SCORE_RULE)
  })
})
