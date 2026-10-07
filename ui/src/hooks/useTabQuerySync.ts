import { toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

/** Tab 与 URL Query 同步选项 */
interface UseTabQuerySyncOptions<T extends string> {
  /** 当前路由信息 */
  route: RouteLocationNormalizedLoaded
  /** 路由器实例 */
  router: Router
  /** 当前激活 Tab 的 Ref */
  activeTab: Ref<T>
  /** 有效的 Tab 值列表 */
  validTabs: MaybeRefOrGetter<readonly T[]>
}

/**
 * Tab 与 URL Query 双向同步
 * 通过 URL 的 ?tab=xxx 参数实现 Tab 切换的浏览器前进/后退和链接分享支持
 * @param options - Tab 同步所需的响应式状态与路由实例
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
