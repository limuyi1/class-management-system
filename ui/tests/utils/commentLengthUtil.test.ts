/**
 * commentLengthUtil 测试
 * 覆盖评语字数统计（countCommentLength）与长度校验提示（getCommentLengthError），
 * 包括空白字符处理、最小/最大字数边界与末尾空白等场景。
 */

import { describe, expect, it } from 'vitest'

import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  countCommentLength,
  getCommentLengthError
} from '@/utils/evaluation/commentLengthUtil'

describe('commentLengthUtil', () => {
  // 字数统计：验证空值返回 0，以及统计时忽略所有空白字符
  describe('countCommentLength', () => {
    it('空值返回 0', () => {
      expect(countCommentLength(null)).toBe(0)
      expect(countCommentLength(undefined)).toBe(0)
      expect(countCommentLength('')).toBe(0)
    })

    it('忽略所有空白字符统计字数', () => {
      expect(countCommentLength('你好 世界')).toBe(4)
      expect(countCommentLength('  a\nb\tc  ')).toBe(3)
    })
  })

  // 长度校验：验证空评语不报错、字数不足/超限报错与末尾空白不计入
  describe('getCommentLengthError', () => {
    it('空评语不报错', () => {
      expect(getCommentLengthError('')).toBe('')
      expect(getCommentLengthError(null)).toBe('')
    })

    it('少于最小字数时报错', () => {
      expect(getCommentLengthError('短')).toBe(`当前 1 字，少于 ${COMMENT_MIN_LENGTH} 字`)
    })

    it('达到最小字数时不报错', () => {
      expect(getCommentLengthError('a'.repeat(COMMENT_MIN_LENGTH))).toBe('')
    })

    it('超过最大字数时报错', () => {
      expect(getCommentLengthError('a'.repeat(COMMENT_MAX_LENGTH + 1))).toBe(
        `当前 ${COMMENT_MAX_LENGTH + 1} 字，超过 ${COMMENT_MAX_LENGTH} 字`
      )
    })

    it('长度计算忽略末尾空白', () => {
      expect(getCommentLengthError('a'.repeat(COMMENT_MIN_LENGTH) + '   ')).toBe('')
    })
  })
})
