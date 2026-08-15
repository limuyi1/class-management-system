import { describe, expect, it } from 'vitest'

import {
  buildTemplateScoreNoticeComment,
  getScoreNoticeCommentValidationReasons,
  normalizeScoreNoticeComment
} from '../../src/utils/scoreNoticeCommentUtil'
import { ScoreNoticeCommentStatusEnum } from '../../src/types/ScoreNotice'

describe('scoreNoticeCommentUtil', () => {
  it('rejects comments that reveal concrete scores or rankings', () => {
    expect(getScoreNoticeCommentValidationReasons('本次考试获得了95分，整体表现不错。')).toEqual(
      expect.arrayContaining(['包含具体数字或百分比'])
    )
    expect(getScoreNoticeCommentValidationReasons('本次排名有所提升，继续保持。')).toEqual(
      expect.arrayContaining(['包含名次或排名信息'])
    )
  })

  it('accepts a qualitative exam comment', () => {
    const comment =
      '张明轩平时学习态度认真，课堂上能够保持专注，也愿意主动整理学习中遇到的问题。近期整体状态较为稳定，面对不同学习任务时能够按照自己的节奏认真完成，并逐渐形成了及时复习和归纳整理的习惯。\n\n本次考试中，语文和数学表现较为扎实，英语发挥稳定，科学仍有进一步提升的空间。建议认真分析科学学习中出现的问题，区分知识理解、审题和答题习惯等不同原因，通过回顾课本、整理错题和针对性练习逐项巩固。希望你保持优势学科的学习节奏，同时耐心补足薄弱环节，让各科表现更加均衡。'
    expect(getScoreNoticeCommentValidationReasons(comment)).toEqual([])
  })

  it('requires score notice comments to contain 180 to 320 Chinese characters', () => {
    expect(getScoreNoticeCommentValidationReasons('认真学习，继续进步。')).toContain(
      '评语少于180字'
    )
    expect(getScoreNoticeCommentValidationReasons('学习态度认真。'.repeat(55))).toContain(
      '评语超过320字'
    )
  })

  it('keeps paragraph breaks while removing blank lines from generated notice comments', () => {
    expect(normalizeScoreNoticeComment('第一段内容。\n\n第二段内容。\r\n第三段内容。')).toBe(
      '第一段内容。\n第二段内容。\n第三段内容。'
    )
  })

  it('builds a qualified detailed template comment when AI is unavailable', () => {
    const comment = buildTemplateScoreNoticeComment(
      {
        id: 'student-1',
        name: '陈丁麟',
        rawValues: {},
        gradeValues: { chinese: 'C', math: 'B', english: 'B', science: 'C' },
        comment: '',
        commentStatus: ScoreNoticeCommentStatusEnum.Pending
      },
      [
        { id: 'chinese', label: '语文', sourceColumn: '语文', rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 } },
        { id: 'math', label: '数学', sourceColumn: '数学', rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 } },
        { id: 'english', label: '英语', sourceColumn: '英语', rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 } },
        { id: 'science', label: '科学', sourceColumn: '科学', rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 } }
      ]
    )

    expect(comment).toContain('本次考试')
    expect(comment).toContain('语文、科学')
    expect(getScoreNoticeCommentValidationReasons(comment)).toEqual([])
  })
})
