import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { useTabQuerySync } from '../../src/hooks/useTabQuerySync'

type TabType = 'system-backup' | 'label-maintenance'

const flush = async () => {
  await nextTick()
  await Promise.resolve()
}

describe('useTabQuerySync', () => {
  const validTabs = ['system-backup', 'label-maintenance'] as const

  let route: { query: Record<string, unknown> }
  let router: { replace: ReturnType<typeof vi.fn> }
  let activeTab: ReturnType<typeof ref<TabType>>

  beforeEach(() => {
    route = reactive({ query: {} as Record<string, unknown> })
    router = {
      replace: vi.fn().mockResolvedValue(undefined)
    }
    activeTab = ref<TabType>('system-backup')
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

  it('should ignore edit tag query from legacy student-info tab flow', async () => {
    route.query = {
      tab: 'system-backup',
      'edit-tags': '1',
      'student-name': '张三'
    }

    useTabQuerySync({
      route: route as never,
      router: router as never,
      activeTab,
      validTabs
    })

    await flush()

    expect(activeTab.value).toBe('system-backup')
    expect(router.replace).not.toHaveBeenCalled()
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

  it('should respect reactive validTabs', async () => {
    const dynamicValidTabs = ref<Array<TabType>>(['label-maintenance'])
    activeTab.value = 'label-maintenance'
    route.query = { tab: 'system-backup' }

    useTabQuerySync({
      route: route as never,
      router: router as never,
      activeTab,
      validTabs: dynamicValidTabs
    })

    await flush()
    expect(activeTab.value).toBe('label-maintenance')

    dynamicValidTabs.value = ['system-backup', 'label-maintenance']
    route.query = { tab: 'system-backup' }
    await flush()

    expect(activeTab.value).toBe('system-backup')
  })
})
