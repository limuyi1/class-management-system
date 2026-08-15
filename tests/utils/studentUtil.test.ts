import { describe, expect, it } from 'vitest'
import {
  createStudentId,
  extractStudentTags,
  findStudentById,
  hasValidStudentIds,
  normalizeRecentScoreEntries,
  normalizeStoredStudents
} from '../../src/utils/studentUtil'

describe('student identity utilities', () => {
  it('creates UUID student IDs', () => {
    expect(createStudentId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('accepts only complete and unique student IDs', () => {
    expect(
      hasValidStudentIds([
        { studentId: 'student-1', name: '张三' },
        { studentId: 'student-2', name: '张三' }
      ])
    ).toBe(true)
    expect(hasValidStudentIds([{ name: '张三' }])).toBe(false)
    expect(
      hasValidStudentIds([
        { studentId: 'student-1', name: '张三' },
        { studentId: 'student-1', name: '李四' }
      ])
    ).toBe(false)
  })

  it('treats a legacy stored list without IDs as no data', () => {
    expect(normalizeStoredStudents([{ name: '张三' }])).toEqual([])
  })

  it('finds students by ID even when names are duplicated', () => {
    const students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '张三' }
    ]
    expect(findStudentById(students, 'student-2')).toBe(students[1])
  })

  it('drops legacy recent score entries that still use array indexes', () => {
    expect(
      normalizeRecentScoreEntries({
        math: [
          { index: 1, name: '张三', score: 90, time: '10:00:00' },
          {
            studentId: 'student-2',
            name: '李四',
            score: 88,
            time: '10:01:00'
          }
        ]
      })
    ).toEqual({
      math: [
        {
          studentId: 'student-2',
          name: '李四',
          score: 88,
          time: '10:01:00'
        }
      ]
    })
  })
})

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
