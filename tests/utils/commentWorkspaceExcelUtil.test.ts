/**
 * commentWorkspaceExcelUtil 测试
 * 覆盖 Excel 评语工作区的构建与回写：临时标签解析（parseTemporaryCommentTags）、
 * 工作区行构建（buildExcelCommentWorkspace）与单元格更新（buildExcelCommentCellUpdates）。
 */

import { describe, expect, it } from 'vitest'

import {
  EXCEL_COMMENT_ROW_PROP,
  EXCEL_COMMENT_TAG_PROP,
  buildExcelCommentCellUpdates,
  buildExcelCommentWorkspace,
  parseTemporaryCommentTags
} from '../../src/utils/evaluation/commentWorkspaceExcelUtil'
import { NAME_PROP } from '../../src/constants'

// Excel 评语工作区：临时标签解析、工作区构建与回写单元格定位
describe('commentWorkspaceExcelUtil', () => {
  it('splits temporary tags by common punctuation without splitting spaces in a tag', () => {
    expect(
      parseTemporaryCommentTags('认真、积极；书写 工整, 乐于助人\n积极|善于表达/守纪律')
    ).toEqual(['认真', '积极', '书写 工整', '乐于助人', '善于表达', '守纪律'])
  })

  it('keeps duplicate names as independent temporary rows and never matches system IDs', () => {
    const result = buildExcelCommentWorkspace({
      rows: [
        ['姓名', '原评语', '标签'],
        ['张三', '第一条', '认真、积极'],
        ['张三', '第二条', '稳重；认真'],
        ['', '没有姓名', '跳过']
      ],
      headerRowIndex: 0,
      nameColumn: '姓名',
      commentColumn: '原评语',
      tagColumn: '标签'
    })

    expect(result.students).toHaveLength(2)
    expect(result.students.map((student) => student.studentId)).toEqual(['excel:1', 'excel:2'])
    expect(result.students.map((student) => student[NAME_PROP])).toEqual(['张三', '张三'])
    expect(result.students[0].tags?.[EXCEL_COMMENT_TAG_PROP]).toEqual(['认真', '积极'])
    expect(result.students[1][EXCEL_COMMENT_ROW_PROP]).toBe(2)
    expect(result.skippedEmptyNameCount).toBe(1)
  })

  it('overwrites the selected comment column while preserving original row positions', () => {
    const students = [
      {
        studentId: 'excel:2',
        [NAME_PROP]: '李四',
        comment: '处理后的评语',
        [EXCEL_COMMENT_ROW_PROP]: 2
      }
    ]

    expect(
      buildExcelCommentCellUpdates({
        rows: [
          ['姓名', '评语', '其他列'],
          ['张三', '保持原值', 'A'],
          ['李四', '原评语', 'B']
        ],
        headerRowIndex: 0,
        commentColumn: '评语',
        students
      })
    ).toEqual([{ rowIndex: 2, columnIndex: 1, value: '处理后的评语' }])
  })

  it('adds a comment column when the import did not select one', () => {
    const students = [
      {
        studentId: 'excel:1',
        [NAME_PROP]: '张三',
        comment: '新评语',
        [EXCEL_COMMENT_ROW_PROP]: 1
      }
    ]

    expect(
      buildExcelCommentCellUpdates({
        rows: [
          ['姓名', '标签'],
          ['张三', '认真']
        ],
        headerRowIndex: 0,
        students
      })
    ).toEqual([
      { rowIndex: 0, columnIndex: 2, value: '评语' },
      { rowIndex: 1, columnIndex: 2, value: '新评语' }
    ])
  })
})
