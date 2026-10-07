import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useToolsStore } from '../../src/stores/tools'

/**
 * useToolsStore store 测试
 * 测试目标：工具模块 store
 * 覆盖功能：纸张布局默认设置、不同实例之间状态隔离
 */
describe('useToolsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes paper layout with default settings', () => {
    const store = useToolsStore()

    expect(store.paperLayout).toEqual({
      pageType: 'A4',
      orientation: 'landscape',
      layoutMode: 'double',
      columns: 2,
      fitMode: 'slot',
      margin: 0,
      gap: 0
    })
  })

  it('keeps paper layout state isolated between store instances', () => {
    const store = useToolsStore()
    store.paperLayout.columns = 3
    store.paperLayout.orientation = 'portrait'

    setActivePinia(createPinia())
    const nextStore = useToolsStore()

    expect(nextStore.paperLayout.columns).toBe(2)
    expect(nextStore.paperLayout.orientation).toBe('landscape')
  })
})
