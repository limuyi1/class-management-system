import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ScoreNoticePreview from '../../src/views/score-notice/components/ScoreNoticePreview.vue'
import { ScoreNoticeCommentStatusEnum, ScoreNoticeModeEnum } from '../../src/types/ScoreNotice'

import type { ScoreNoticeStudentType, ScoreNoticeSubjectType } from '../../src/types/ScoreNotice'

/**
 * ScoreNoticePreview 组件测试
 * 测试目标：成绩通知单预览（报告图样）
 * 覆盖功能：等级/分数两种展示模式、分数长度样式类、科目数量对应的网格密度
 */

// 两门固定科目，用于大多数用例；语文满分 100、科学满分 50
const subjects = [
  {
    id: 'chinese',
    label: '语文',
    sourceColumn: '语文',
    rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 }
  },
  {
    id: 'science',
    label: '科学',
    sourceColumn: '科学',
    rule: { maxScore: 50, gradeAMin: 40, gradeBMin: 30 }
  }
]

// 按需生成指定数量的科目，用于验证 6-10 门与 10 门以上时的网格密度
const createSubjects = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `subject-${index + 1}`,
    label: `科目${index + 1}`,
    sourceColumn: `科目${index + 1}`,
    rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 }
  }))

// 包含原始分、等级与评语的标准学生数据
const student = {
  id: 'student-1',
  name: '张明轩',
  rawValues: { chinese: 86, science: 35 },
  gradeValues: { chinese: 'A', science: 'B' },
  comment: '本次考试整体表现良好，学习态度认真，继续保持细心审题和及时复习的习惯。',
  commentStatus: ScoreNoticeCommentStatusEnum.Generated
}

// 验证报告图样的渲染：科目、等级/分数、评语与布局密度
describe('ScoreNoticePreview', () => {
  it('renders arbitrary subjects, grades and comment inside the report image', () => {
    const wrapper = mount(ScoreNoticePreview, {
      props: {
        title: '期中考试等级通知',
        noticeDate: '2026-07-10',
        mode: ScoreNoticeModeEnum.Grade,
        subjects,
        student
      }
    })

    expect(wrapper.find('h1').text()).toBe('期中考试等级通知')
    expect(wrapper.findAll('.score-report__subject')).toHaveLength(2)
    expect(wrapper.findAll('.score-report__grade-wreath')).toHaveLength(2)
    expect(wrapper.findAll('.score-report__grade-ribbon')).toHaveLength(2)
    expect(wrapper.find('.score-report__grade-ribbon').attributes('src')).toContain(
      'grade-ribbon-green-2x'
    )
    expect(wrapper.findAll('.score-report__corner')).toHaveLength(4)
    expect(wrapper.findAll('.score-report__watermark')).toHaveLength(4)
    expect(wrapper.findAll('.score-report__subject-corner')).toHaveLength(8)
    expect(wrapper.find('.score-report__comment-badge').exists()).toBe(true)
    expect(wrapper.findAll('.score-report__grade-medal span').map((item) => item.text())).toEqual([
      'A',
      'B'
    ])
    expect(wrapper.find('.score-report__comment-body').text()).toContain('学习态度认真')
  })

  it('switches the same report to raw score display', () => {
    const wrapper = mount(ScoreNoticePreview, {
      props: {
        title: '期中考试成绩通知',
        noticeDate: '2026-07-10',
        mode: ScoreNoticeModeEnum.Score,
        subjects,
        student
      }
    })

    expect(wrapper.findAll('.score-report__grade-medal span').map((item) => item.text())).toEqual([
      '86',
      '35'
    ])
  })

  it('uses score-length classes for three- and four-character score displays', () => {
    const wrapper = mount(ScoreNoticePreview, {
      props: {
        title: '期中考试成绩通知',
        noticeDate: '2026-07-10',
        mode: ScoreNoticeModeEnum.Score,
        subjects,
        student: {
          ...student,
          rawValues: { chinese: 89.5, science: 100 }
        }
      }
    })

    expect(wrapper.findAll('.score-report__grade-medal--score-length-4')).toHaveLength(1)
    expect(wrapper.findAll('.score-report__grade-medal--score-length-3')).toHaveLength(1)
    expect(wrapper.findAll('.score-report__grade-ring span').map((item) => item.text())).toEqual([
      '89.5',
      '100'
    ])
  })

  it('uses a compact five-column grid when there are six to ten subjects', () => {
    const wrapper = mount(ScoreNoticePreview, {
      props: {
        title: '期中考试等级通知',
        noticeDate: '2026-07-10',
        mode: ScoreNoticeModeEnum.Grade,
        subjects: createSubjects(6),
        student
      }
    })

    expect(wrapper.classes()).toContain('score-report--subjects-compact')
    expect(wrapper.findAll('.score-report__subject')).toHaveLength(6)
    expect(wrapper.find('.score-report__subject-grid').attributes('style')).toContain(
      '--subject-card-width: calc((100% - 56px) / 5)'
    )
  })

  it('uses a denser six-column grid when there are more than ten subjects', () => {
    const wrapper = mount(ScoreNoticePreview, {
      props: {
        title: '期中考试等级通知',
        noticeDate: '2026-07-10',
        mode: ScoreNoticeModeEnum.Grade,
        subjects: createSubjects(12),
        student
      }
    })

    expect(wrapper.classes()).toContain('score-report--subjects-dense')
    expect(wrapper.findAll('.score-report__subject')).toHaveLength(12)
    expect(wrapper.find('.score-report__subject-grid').attributes('style')).toContain(
      '--subject-card-width: calc((100% - 50px) / 6)'
    )
  })
})

/** 组件拆分后的额外回归检查，不替代原有展示用例。 */
describe('通知单拆分回归', () => {
  const student: ScoreNoticeStudentType = {
    id: 's1',
    name: '张三',
    rawValues: { math: 98 },
    gradeValues: { math: 'A' },
    comment: '保持认真学习的好习惯。',
    commentStatus: ScoreNoticeCommentStatusEnum.Manual
  }

  const subject: ScoreNoticeSubjectType = {
    id: 'math',
    label: '数学',
    sourceColumn: '数学',
    rule: { maxScore: 100, gradeAMin: 90, gradeBMin: 75 }
  }

  describe('成绩通知预览', () => {
    it.each([
      [1, 'standard'],
      [6, 'compact'],
      [11, 'dense']
    ] as const)('%i 科目保留 %s 密度和完整导出节点', (count, density) => {
      const subjects = Array.from({ length: count }, (_, index) => ({
        ...subject,
        id: index ? `s${index}` : 'math'
      }))
      const wrapper = mount(ScoreNoticePreview, {
        props: {
          title: '期末成绩通知',
          noticeDate: '2026-10-03',
          mode: ScoreNoticeModeEnum.Score,
          subjects,
          student
        }
      })
      expect(wrapper.classes()).toContain(`score-report--subjects-${density}`)
      expect(wrapper.findAll('.score-report__subject')).toHaveLength(count)
      expect(wrapper.get('.score-report__header').text()).toContain('期末成绩通知')
      expect(wrapper.get('.score-report__comment').text()).toContain(student.comment)
      expect(wrapper.vm.getElement()).toBe(wrapper.element)
      wrapper.unmount()
    })

    it('切换等级模式后更新卡片，长评语保留自适应样式', async () => {
      const wrapper = mount(ScoreNoticePreview, {
        props: {
          title: '成绩通知',
          noticeDate: '2026-10-03',
          mode: ScoreNoticeModeEnum.Score,
          subjects: [subject],
          student
        }
      })
      expect(wrapper.get('.score-report__grade-ring').text()).toContain('98')
      await wrapper.setProps({
        mode: ScoreNoticeModeEnum.Grade,
        student: { ...student, comment: '好'.repeat(301) }
      })
      expect(wrapper.get('.score-report__grade-ring').text()).toContain('A')
      expect(wrapper.get('.score-report__comment').classes()).toContain(
        'score-report__comment--long'
      )
      wrapper.unmount()
    })
  })
})
