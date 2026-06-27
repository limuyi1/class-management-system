import { describe, expect, it } from 'vitest'

import { buildExcelDataFromHeaderRow } from '../../src/utils/xlsxUntil'

describe('xlsxUntil', () => {
  it('builds import data from the user selected header row', () => {
    const result = buildExcelDataFromHeaderRow(
      [
        ['2026年期中考试成绩表', null, null],
        ['班级：三年级一班', null, null],
        ['序号', '姓名', '数学'],
        [1, '张三', 96],
        [2, '李四', 88]
      ],
      2
    )

    expect(result.header).toEqual(['序号', '姓名', '数学'])
    expect(result.data).toEqual([
      { 序号: 1, 姓名: '张三', 数学: 96 },
      { 序号: 2, 姓名: '李四', 数学: 88 }
    ])
  })

  it('uses fallback names for empty header cells', () => {
    const result = buildExcelDataFromHeaderRow(
      [
        ['姓名', null],
        ['张三', 90]
      ],
      0
    )

    expect(result.header).toEqual(['姓名', 'UNKNOWN 1'])
    expect(result.data[0]).toEqual({ 姓名: '张三', 'UNKNOWN 1': 90 })
  })
})
