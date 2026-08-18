import { describe, expect, it } from 'vitest'

import { normalizeScoreColumns } from '@/utils/settingMigrationUtil'

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
