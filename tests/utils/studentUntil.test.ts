import { describe, expect, it } from 'vitest'
import { extractStudentTags } from '../../src/utils/studentUntil'

describe('extractStudentTags', () => {
  const mockTagCategoryList = [
    { prop: 'category1', label: '分类1' },
    { prop: 'category2', label: '分类2' },
    { prop: 'category3', label: '分类3' }
  ]

  it('should return empty array when item has no tags', () => {
    const item = {}
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual([])
  })

  it('should return empty array when item has empty tags object', () => {
    const item = { tags: {} }
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual([])
  })

  it('should return empty array when item has no matching categories', () => {
    const item = { tags: { otherCategory: ['tag1', 'tag2'] } }
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual([])
  })

  it('should extract tags from single matching category', () => {
    const item = { tags: { category1: ['tag1', 'tag2'] } }
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual(['tag1', 'tag2'])
  })

  it('should extract tags from multiple matching categories', () => {
    const item = {
      tags: {
        category1: ['tag1', 'tag2'],
        category2: ['tag3', 'tag4']
      }
    }
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual(['tag1', 'tag2', 'tag3', 'tag4'])
  })

  it('should skip categories with empty tag arrays', () => {
    const item = {
      tags: {
        category1: ['tag1'],
        category2: [],
        category3: ['tag2']
      }
    }
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual(['tag1', 'tag2'])
  })

  it('should handle tags with undefined tagList', () => {
    const item = {
      tags: {
        category1: undefined,
        category2: ['tag1']
      }
    }
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual(['tag1'])
  })

  it('should return all tags from all categories', () => {
    const item = {
      tags: {
        category1: ['a', 'b'],
        category2: ['c', 'd'],
        category3: ['e', 'f']
      }
    }
    const result = extractStudentTags(item, mockTagCategoryList)
    expect(result).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('should work with empty tagCategoryList', () => {
    const item = { tags: { category1: ['tag1'] } }
    const result = extractStudentTags(item, [])
    expect(result).toEqual([])
  })
})
