/**
 * nameListCompare 测试
 * 覆盖名单比对工具：姓名规范化（normalizeName）、粘贴内容解析（parsePastedRows）、
 * 名单条目构建（buildNameEntries）、比对结果生成（buildNameListCompareResult）与姓名列推荐（findSuggestedNameColumn）。
 */

import { describe, expect, it } from 'vitest'

import {
  buildNameEntries,
  buildNameListCompareResult,
  findSuggestedNameColumn,
  normalizeName,
  parsePastedRows
} from '../../src/views/tools/utils/nameListCompare'

// 名单比对：姓名规范化、粘贴解析、比对结果汇总与姓名列推荐
describe('nameListCompare', () => {
  it('normalizes names by trimming leading and trailing spaces', () => {
    expect(normalizeName(' 张三 ')).toBe('张三')
    expect(normalizeName('')).toBe('')
    expect(normalizeName(undefined)).toBe('')
  })

  it('parses single-column pasted names', () => {
    const result = parsePastedRows('张三\n李四\n\n王五')

    expect(result.headers).toEqual(['姓名'])
    expect(result.rows).toEqual([{ 姓名: '张三' }, { 姓名: '李四' }, { 姓名: '王五' }])
  })

  it('parses pasted table content and uses first row as headers', () => {
    const result = parsePastedRows('姓名\t数学\n张三\t95\n李四\t88')

    expect(result.headers).toEqual(['姓名', '数学'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ 姓名: '张三', 数学: '95' })
  })

  it('builds comparison rows based on baseline order without mutating source order', () => {
    const baselineEntries = buildNameEntries(
      [{ 姓名: '张三' }, { 姓名: ' 李四 ' }, { 姓名: '' }, { 姓名: '王五' }],
      '姓名'
    )
    const comparisonEntries = buildNameEntries(
      [{ 学生: '王五' }, { 学生: '张三' }, { 学生: '赵六' }],
      '学生'
    )

    const result = buildNameListCompareResult({
      baselineEntries,
      comparisonEntries
    })

    expect(result.rows).toEqual([
      { baselineName: '张三', comparisonName: '张三', matched: true },
      { baselineName: '李四', comparisonName: '', matched: false },
      { baselineName: '王五', comparisonName: '王五', matched: true },
      { baselineName: '', comparisonName: '赵六', matched: false }
    ])
    expect(result.summary).toEqual({
      baselineCount: 3,
      comparisonCount: 3,
      matchedCount: 2,
      baselineOnlyCount: 1,
      comparisonOnlyCount: 1
    })
    expect(result.groups).toEqual({
      baselineOnly: ['李四'],
      comparisonOnly: ['赵六'],
      matched: ['张三', '王五']
    })
  })

  it('suggests a name column from common headers', () => {
    expect(findSuggestedNameColumn(['班级', '姓名', '数学'])).toBe('姓名')
    expect(findSuggestedNameColumn(['学生姓名', '成绩'])).toBe('学生姓名')
    expect(findSuggestedNameColumn(['列1', '列2'])).toBe('列1')
  })
})
