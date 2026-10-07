import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useScoreNoticeStore } from '../../src/stores/score-notice'
import {
  ScoreNoticeCommentStatusEnum,
  ScoreNoticeModeEnum,
  type ScoreNoticeStudentType
} from '../../src/types/ScoreNotice'

/**
 * useScoreNoticeStore store 测试
 * 测试目标：成绩通知单 store
 * 覆盖功能：默认状态、导入结果应用、学生选中、评语校验三分支、状态计数 getter、
 * 科目规则重算、重置通知单
 */
describe('useScoreNoticeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** 构造指定状态的学生条目 */
  const createStudent = (
    id: string,
    overrides: Partial<ScoreNoticeStudentType> = {}
  ): ScoreNoticeStudentType => ({
    id,
    name: `学生${id}`,
    rawValues: {},
    gradeValues: {},
    comment: '',
    commentStatus: ScoreNoticeCommentStatusEnum.Pending,
    ...overrides
  })

  /** 构造一条通过校验的长评语（不含数字与名次表述） */
  const validComment = (): string => '很'.repeat(190)

  it('initializes with default notice state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00'))

    const store = useScoreNoticeStore()

    expect(store.title).toBe('期中考试等级通知')
    expect(store.noticeDate).toBe('2026-09-07')
    expect(store.mode).toBe(ScoreNoticeModeEnum.Grade)
    expect(store.sourceMode).toBe(ScoreNoticeModeEnum.Grade)
    expect(store.sourceFileName).toBe('')
    expect(store.subjects).toEqual([])
    expect(store.students).toEqual([])
    expect(store.selectedStudentId).toBe('')
  })

  it('applies import result and selects the first student', () => {
    const store = useScoreNoticeStore()
    const first = createStudent('s1')
    const second = createStudent('s2')

    store.applyImport(
      {
        sourceMode: ScoreNoticeModeEnum.Score,
        subjects: [{ id: 'yu3_wen2_0', label: '语文', sourceColumn: '语文', rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 } }],
        students: [first, second],
        invalidCellCount: 2,
        duplicateNames: []
      },
      '成绩.xlsx'
    )

    expect(store.sourceMode).toBe(ScoreNoticeModeEnum.Score)
    // 导入后展示模式始终重置为等级制
    expect(store.mode).toBe(ScoreNoticeModeEnum.Grade)
    expect(store.sourceFileName).toBe('成绩.xlsx')
    expect(store.subjects).toHaveLength(1)
    expect(store.students).toHaveLength(2)
    expect(store.selectedStudentId).toBe('s1')
  })

  it('returns the selected student or null', () => {
    const store = useScoreNoticeStore()
    store.students = [createStudent('s1'), createStudent('s2')]

    expect(store.selectedStudent).toBeNull()

    store.selectStudent('s2')
    expect(store.selectedStudent?.name).toBe('学生s2')
  })

  it('counts students by comment status', () => {
    const store = useScoreNoticeStore()
    store.students = [
      createStudent('a', { commentStatus: ScoreNoticeCommentStatusEnum.Generated }),
      createStudent('b', { commentStatus: ScoreNoticeCommentStatusEnum.Manual }),
      createStudent('c', { commentStatus: ScoreNoticeCommentStatusEnum.Pending }),
      createStudent('d', { commentStatus: ScoreNoticeCommentStatusEnum.Failed }),
      createStudent('e', { commentStatus: ScoreNoticeCommentStatusEnum.Missing }),
      createStudent('f', { commentStatus: ScoreNoticeCommentStatusEnum.NeedsReview })
    ]

    expect(store.generatedCount).toBe(2)
    expect(store.pendingCount).toBe(2)
    expect(store.missingCount).toBe(1)
    expect(store.reviewCount).toBe(1)
  })

  it('marks manual edit as Manual when comment passes validation', () => {
    const store = useScoreNoticeStore()
    store.students = [createStudent('s1')]

    store.updateStudentComment('s1', validComment())

    expect(store.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Manual)
    expect(store.students[0].validationReasons).toEqual([])
    expect(store.students[0].errorMessage).toBeUndefined()
  })

  it('marks auto generated comment as Generated when validation passes', () => {
    const store = useScoreNoticeStore()
    store.students = [createStudent('s1')]

    store.updateStudentComment('s1', validComment(), false)

    expect(store.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Generated)
  })

  it('marks comment as NeedsReview when it is too short', () => {
    const store = useScoreNoticeStore()
    store.students = [createStudent('s1')]

    store.updateStudentComment('s1', '表现不错')

    expect(store.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.NeedsReview)
    expect(store.students[0].validationReasons).toContain('评语少于180字')
    expect(store.students[0].errorMessage).toContain('评语少于180字')
  })

  it('collects multiple validation reasons including digits and rank words', () => {
    const store = useScoreNoticeStore()
    store.students = [createStudent('s1')]

    store.updateStudentComment('s1', '本次考了90分，班级第二名')

    const reasons = store.students[0].validationReasons || []
    expect(reasons).toContain('包含具体数字或百分比')
    expect(reasons).toContain('包含名次或排名信息')
    expect(reasons).toContain('评语少于180字')
  })

  it('ignores comments for unknown students', () => {
    const store = useScoreNoticeStore()
    store.students = [createStudent('s1')]

    expect(() => store.updateStudentComment('missing', validComment())).not.toThrow()
    expect(store.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Pending)
  })

  it('updates comment status with optional error message', () => {
    const store = useScoreNoticeStore()
    store.students = [createStudent('s1')]

    store.updateCommentStatus('s1', ScoreNoticeCommentStatusEnum.Failed, '请求超时')

    expect(store.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Failed)
    expect(store.students[0].errorMessage).toBe('请求超时')

    store.updateCommentStatus('s1', ScoreNoticeCommentStatusEnum.Generated)
    expect(store.students[0].errorMessage).toBeUndefined()
  })

  it('recalculates grade values after subject rule update', () => {
    const store = useScoreNoticeStore()
    store.subjects = [
      { id: 'yu3_wen2_0', label: '语文', sourceColumn: '语文', rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 } }
    ]
    store.students = [createStudent('s1', { rawValues: { yu3_wen2_0: 90 }, gradeValues: { yu3_wen2_0: 'A' } })]

    store.updateSubjectRule('yu3_wen2_0', { maxScore: 100, gradeAMin: 95, gradeBMin: 60 })

    expect(store.subjects[0].rule.gradeAMin).toBe(95)
    // 90 分在新规则下落入 B 档
    expect(store.students[0].gradeValues.yu3_wen2_0).toBe('B')
  })

  it('ignores rule update for unknown subjects', () => {
    const store = useScoreNoticeStore()
    store.subjects = [
      { id: 'yu3_wen2_0', label: '语文', sourceColumn: '语文', rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 } }
    ]
    store.students = [createStudent('s1', { rawValues: { yu3_wen2_0: 90 }, gradeValues: { yu3_wen2_0: 'A' } })]

    store.updateSubjectRule('missing', { maxScore: 100, gradeAMin: 95, gradeBMin: 60 })

    expect(store.students[0].gradeValues.yu3_wen2_0).toBe('A')
  })

  it('resets to default state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00'))
    const store = useScoreNoticeStore()
    store.applyImport(
      {
        sourceMode: ScoreNoticeModeEnum.Score,
        subjects: [],
        students: [createStudent('s1')],
        invalidCellCount: 0,
        duplicateNames: []
      },
      '成绩.xlsx'
    )
    store.title = '自定义标题'

    store.resetNotice()

    expect(store.title).toBe('期中考试等级通知')
    expect(store.noticeDate).toBe('2026-09-07')
    expect(store.students).toEqual([])
    expect(store.subjects).toEqual([])
    expect(store.sourceFileName).toBe('')
    expect(store.selectedStudentId).toBe('')
  })
})
