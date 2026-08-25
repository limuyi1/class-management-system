/**
 * 测试 settingMigrationUtil 的 normalizeScoreColumns。
 * 覆盖：旧成绩列数据迁移时的空数组回退、缺失的 disabled 字段补齐 false、保留已有值。
 */
import { describe, expect, it } from 'vitest'

import { normalizeScoreColumns } from '@/utils/settingMigrationUtil'

// 成绩列数据迁移归一化测试组
describe('normalizeScoreColumns', () => {
  it('空数组返回空数组', () => {
    expect(normalizeScoreColumns([])).toEqual([])
  })

  it('为缺失的 disabled 字段补 false', () => {
    const result = normalizeScoreColumns([{ prop: 'unit1', label: '第一单元' }])

    expect(result).toEqual([{ prop: 'unit1', label: '第一单元', disabled: false }])
  })

  it('保留已有的 disabled 值', () => {
    const result = normalizeScoreColumns([
      { prop: 'unit1', label: '第一单元', disabled: true },
      { prop: 'unit2', label: '第二单元', disabled: false }
    ])

    expect(result).toEqual([
      { prop: 'unit1', label: '第一单元', disabled: true },
      { prop: 'unit2', label: '第二单元', disabled: false }
    ])
  })
})
