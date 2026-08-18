import { toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

interface UseTabQuerySyncOptions<T extends string> {
  route: RouteLocationNormalizedLoaded
  router: Router
  /** 当前激活 Tab 的 Ref */
  activeTab: Ref<T>
  /** 有效的 Tab 值列表 */
  validTabs: MaybeRefOrGetter<readonly T[]>
}

/**
 * Tab 与 URL Query 双向同步
 * 通过 URL 的 ?tab=xxx 参数实现 Tab 切换的浏览器前进/后退和链接分享支持
 */
export function useTabQuerySync<T extends string>(options: UseTabQuerySyncOptions<T>) {
  const { route, router, activeTab, validTabs } = options

  // URL query 变化时同步激活 Tab（支持前进/后退和链接分享）
  watch(
    () => route.query,
    (query) => {
      const tab = query.tab
      const currentValidTabs = toValue(validTabs)
      if (typeof tab === 'string' && currentValidTabs.includes(tab as T)) {
        activeTab.value = tab as T
      }
    },
    { immediate: true }
  )

  // 激活 Tab 变化时回写 URL query
  watch(activeTab, async (newTab) => {
    if (route.query.tab === newTab) return

    await router.replace({ path: '/setting', query: { tab: newTab } })
  })
}
