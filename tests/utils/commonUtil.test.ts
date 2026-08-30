/**
 * commonUtil 测试
 * 覆盖数组分组工具 groupArray 与延时工具 delay，
 * 包括空数组、余数分组、分组大小边界与假定时器下的延时解析等场景。
 */

import { describe, expect, it, vi } from 'vitest'
import { groupArray, delay } from '../../src/utils/commonUtil'

// 数组分组：验证空输入、按指定大小切分与末尾不足一组等场景
describe('groupArray', () => {
  it('should return empty array when input is empty', () => {
    const result = groupArray([], 3)
    expect(result).toEqual([])
  })

  it('should split array into groups of specified size', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const result = groupArray(input, 2)
    expect(result).toEqual([
      [1, 2],
      [3, 4],
      [5, 6]
    ])
  })

  it('should handle partial last group', () => {
    const input = [1, 2, 3, 4, 5]
    const result = groupArray(input, 2)
    expect(result).toEqual([[1, 2], [3, 4], [5]])
  })

  it('should handle exact division', () => {
    const input = [1, 2, 3, 4]
    const result = groupArray(input, 2)
    expect(result).toEqual([
      [1, 2],
      [3, 4]
    ])
  })

  it('should handle group size larger than array length', () => {
    const input = [1, 2, 3]
    const result = groupArray(input, 5)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('should handle group size of 1', () => {
    const input = [1, 2, 3]
    const result = groupArray(input, 1)
    expect(result).toEqual([[1], [2], [3]])
  })

  it('should work with string array', () => {
    const input = ['a', 'b', 'c', 'd']
    const result = groupArray(input, 2)
    expect(result).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })

  it('should work with object array', () => {
    const input = [{ a: 1 }, { b: 2 }, { c: 3 }]
    const result = groupArray(input, 2)
    expect(result).toEqual([[{ a: 1 }, { b: 2 }], [{ c: 3 }]])
  })
})

// 延时工具：使用假定时器验证指定毫秒后 promise 被解析
describe('delay', () => {
  // 每个用例前启用假定时器，避免真实等待
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should resolve after specified milliseconds', async () => {
    const ms = 1000
    const promise = delay(ms)

    vi.advanceTimersByTime(ms)

    await expect(promise).resolves.toBeUndefined()
  })

  it('should handle 0 milliseconds', async () => {
    const promise = delay(0)

    vi.advanceTimersByTime(0)

    await expect(promise).resolves.toBeUndefined()
  })
})
