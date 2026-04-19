import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { useTabQuerySync } from '../../src/hooks/useTabQuerySync'

type TabType = 'student-info' | 'label-maintenance'

const flush = async () => {
  await nextTick()
  await Promise.resolve()
}

describe('useTabQuerySync', () => {
  const validTabs = ['student-info', 'label-maintenance'] as const

  let route: { query: Record<string, unknown> }
  let router: { replace: ReturnType<typeof vi.fn> }
  let activeTab: ReturnType<typeof ref<TabType>>

  beforeEach(() => {
    route = reactive({ query: {} as Record<string, unknown> })
    router = {
      replace: vi.fn().mockResolvedValue(undefined)
    }
    activeTab = ref<TabType>('student-info')
  })

  it('should sync tab from query to activeTab', async () => {
    route.query = { tab: 'label-maintenance' }

    useTabQuerySync({
      route: route as never,
      router: router as never,
      activeTab,
      validTabs
    })

    await flush()

    expect(activeTab.value).toBe('label-maintenance')
  })

  it('should trigger edit callback and clear edit query', async () => {
    const onEditTags = vi.fn()
    route.query = {
      tab: 'student-info',
      'edit-tags': '1',
      'student-name': '张三'
    }

    useTabQuerySync({
      route: route as never,
      router: router as never,
      activeTab,
      validTabs,
      onEditTags
    })

    await flush()
    await flush()

    expect(onEditTags).toHaveBeenCalledWith('张三')
    expect(router.replace).toHaveBeenCalled()
    expect(router.replace).toHaveBeenLastCalledWith({
      path: '/setting',
      query: { tab: activeTab.value }
    })
  })

  it('should sync activeTab changes to route query', async () => {
    useTabQuerySync({
      route: route as never,
      router: router as never,
      activeTab,
      validTabs
    })

    await flush()

    activeTab.value = 'label-maintenance'
    await flush()

    expect(router.replace).toHaveBeenCalledWith({
      path: '/setting',
      query: { tab: 'label-maintenance' }
    })
  })
})
