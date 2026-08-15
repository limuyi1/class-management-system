import { describe, expect, it } from 'vitest'

import {
  createUniqueTagCategories,
  createUniqueTagCategory,
  hasCategoryLabel
} from '../../src/utils/tagCategoryUtil'

describe('tagCategoryUtil', () => {
  it('creates a pinyin prop for a new category', () => {
    const category = createUniqueTagCategory('学习习惯', [])

    expect(category).toEqual({
      prop: 'xue2_xi2_xi2_guan4',
      label: '学习习惯'
    })
  })

  it('returns null for empty or duplicate labels', () => {
    const categories = [{ prop: 'xue2_xi2_xi2_guan4', label: '学习习惯' }]

    expect(createUniqueTagCategory(' ', categories)).toBeNull()
    expect(createUniqueTagCategory('学习习惯', categories)).toBeNull()
    expect(hasCategoryLabel(categories, '学习习惯')).toBe(true)
  })

  it('suffixes props when labels produce the same prop', () => {
    const categories = [{ prop: 'xue2_xi2_xi2_guan4', label: '已有分类' }]
    const category = createUniqueTagCategory('学习习惯', categories)

    expect(category).toEqual({
      prop: 'xue2_xi2_xi2_guan4_2',
      label: '学习习惯'
    })
  })

  it('deduplicates generated category labels in one batch', () => {
    const categories = createUniqueTagCategories(['学习习惯', '课堂表现', '学习习惯'], [])

    expect(categories.map((item) => item.label)).toEqual(['学习习惯', '课堂表现'])
  })
})
