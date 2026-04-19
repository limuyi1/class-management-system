import { nextTick, watch, type Ref } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

interface UseTabQuerySyncOptions<T extends string> {
  route: RouteLocationNormalizedLoaded
  router: Router
  activeTab: Ref<T>
  validTabs: readonly T[]
  onEditTags?: (studentName: string) => void
}

export function useTabQuerySync<T extends string>(options: UseTabQuerySyncOptions<T>) {
  const { route, router, activeTab, validTabs, onEditTags } = options

  watch(
    () => route.query,
    async (query) => {
      const tab = query.tab
      if (typeof tab === 'string' && validTabs.includes(tab as T)) {
        activeTab.value = tab as T
      }

      const shouldEditTags = query['edit-tags'] === '1'
      const studentName = query['student-name']

      if (shouldEditTags && typeof studentName === 'string' && studentName) {
        await nextTick()
        onEditTags?.(studentName)
        await router.replace({ path: '/setting', query: { tab: activeTab.value } })
      }
    },
    { immediate: true }
  )

  watch(activeTab, async (newTab) => {
    await router.replace({ path: '/setting', query: { tab: newTab } })
  })
}
