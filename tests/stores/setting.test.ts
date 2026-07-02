import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useSettingStore } from '../../src/stores/setting'

describe('useSettingStore', () => {
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
