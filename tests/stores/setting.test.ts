import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useSettingStore } from '../../src/stores/setting'

/**
 * useSettingStore store 测试
 * 测试目标：设置 store
 * 覆盖功能：预置标签分类与标签的初始化、不同实例之间预置数组互不影响
 */
describe('useSettingStore', () => {
  // 每个用例前创建全新的 Pinia 实例，隔离 store 状态
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with preset tag categories and tags', () => {
    const store = useSettingStore()

    expect(store.tagCategories.length).toBeGreaterThan(0)
    expect(store.tagCategories[0]).toEqual({
      prop: 'xue2_xi2_xi2_guan4',
      label: '学习习惯'
    })
    expect(store.tags.xue2_xi2_xi2_guan4).toContain('勤学善思')
  })

  it('uses fresh preset arrays for each store instance', () => {
    const store = useSettingStore()
    store.tags.xue2_xi2_xi2_guan4.push('临时标签')

    setActivePinia(createPinia())
    const nextStore = useSettingStore()

    expect(nextStore.tags.xue2_xi2_xi2_guan4).not.toContain('临时标签')
  })
})
