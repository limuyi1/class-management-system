/**
 * 测试 scoreNoticeImportUtil 模块。
 * 覆盖：等第/分数两种来源模式的导入构建、原始行顺序保持、重名跳过与非法值统计。
 */
import { describe, expect, it } from 'vitest'

import { ScoreNoticeCommentStatusEnum, ScoreNoticeModeEnum } from '../../src/types/ScoreNotice'
import { buildScoreNoticeImport } from '../../src/utils/score-notice/scoreNoticeImportUtil'

// 成绩通知导入工具函数测试组
describe('scoreNoticeImportUtil', () => {
  it('imports existing grades without conversion', () => {
    const result = buildScoreNoticeImport({
      rows: [
        { 姓名: '张明轩', 语文: 'A等', 数学: 'B' },
        { 姓名: '李雨桐', 语文: 'B', 数学: 'C等' }
      ],
      nameColumn: '姓名',
      subjectColumns: ['语文', '数学'],
      requestedMode: ScoreNoticeModeEnum.Grade
    })

    expect(result.sourceMode).toBe(ScoreNoticeModeEnum.Grade)
    expect(result.students).toHaveLength(2)
    expect(Object.values(result.students[0].gradeValues)).toEqual(['A', 'B'])
    expect(result.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Pending)
  })

  it('converts score columns with per-subject defaults', () => {
    const result = buildScoreNoticeImport({
      rows: [{ 姓名: '张明轩', 语文: 82, 科学: 35 }],
      nameColumn: '姓名',
      subjectColumns: ['语文', '科学'],
      requestedMode: ScoreNoticeModeEnum.Score
    })

    expect(Object.values(result.students[0].gradeValues)).toEqual(['A', 'B'])
  })

  it('keeps the original Excel row order instead of sorting students', () => {
    const result = buildScoreNoticeImport({
      rows: [
        { 姓名: '王五', 语文: 'B' },
        { 姓名: '张三', 语文: 'A' },
        { 姓名: '李四', 语文: 'C' }
      ],
      nameColumn: '姓名',
      subjectColumns: ['语文'],
      requestedMode: ScoreNoticeModeEnum.Grade
    })

    expect(result.students.map((student) => student.name)).toEqual(['王五', '张三', '李四'])
  })

  it('skips duplicate names and reports invalid values', () => {
    const result = buildScoreNoticeImport({
      rows: [
        { 姓名: '重名', 语文: 'A' },
        { 姓名: '重名', 语文: 'B' },
        { 姓名: '正常', 语文: '未知' }
      ],
      nameColumn: '姓名',
      subjectColumns: ['语文'],
      requestedMode: ScoreNoticeModeEnum.Grade
    })

    expect(result.duplicateNames).toEqual(['重名'])
    expect(result.students).toHaveLength(1)
    expect(result.invalidCellCount).toBe(1)
    expect(result.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Missing)
  })
})
