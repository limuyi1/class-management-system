/**
 * useTabQuerySync 组合式函数测试
 * 覆盖：标签页与路由 query 的双向同步（query → activeTab、activeTab 变化 → replace 路由）、
 * 忽略旧版学生信息页遗留的 edit-tags 参数、合法标签集合的响应式更新。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { useTabQuerySync } from '../../src/hooks/useTabQuerySync'

type TabType = 'system-backup' | 'label-maintenance'

// 等待 nextTick 与微任务队列排空，确保 hook 内部的 watch 回调执行完毕
const flush = async () => {
  await nextTick()
  await Promise.resolve()
}

// 目标：验证设置页标签页与 URL query 参数的双向同步及对遗留参数的容错
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
