import { toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

interface UseTabQuerySyncOptions<T extends string> {
  route: RouteLocationNormalizedLoaded
  router: Router
  activeTab: Ref<T>
  validTabs: MaybeRefOrGetter<readonly T[]>
}

export function useTabQuerySync<T extends string>(options: UseTabQuerySyncOptions<T>) {
  const { route, router, activeTab, validTabs } = options

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

  watch(activeTab, async (newTab) => {
    if (route.query.tab === newTab) return

    await router.replace({ path: '/setting', query: { tab: newTab } })
  })
}
