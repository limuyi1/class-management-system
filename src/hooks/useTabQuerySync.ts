import { nextTick, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

interface UseTabQuerySyncOptions<T extends string> {
  route: RouteLocationNormalizedLoaded
  router: Router
  activeTab: Ref<T>
  validTabs: MaybeRefOrGetter<readonly T[]>
  onEditTags?: (studentName: string) => boolean | void | Promise<boolean | void>
  onEditTagsContext?: (query: RouteLocationNormalizedLoaded['query']) => void
}

export function useTabQuerySync<T extends string>(options: UseTabQuerySyncOptions<T>) {
  const { route, router, activeTab, validTabs, onEditTags, onEditTagsContext } = options

  watch(
    () => route.query,
    async (query) => {
      const tab = query.tab
      const currentValidTabs = toValue(validTabs)
      if (typeof tab === 'string' && currentValidTabs.includes(tab as T)) {
        activeTab.value = tab as T
      }

      const shouldEditTags = query['edit-tags'] === '1'
      const studentName = query['student-name']

      if (shouldEditTags && typeof studentName === 'string' && studentName) {
        onEditTagsContext?.(query)
        await nextTick()
        const handled = await onEditTags?.(studentName)
        if (handled !== false) {
          await router.replace({ path: '/setting', query: { tab: activeTab.value } })
        }
      }
    },
    { immediate: true }
  )

  watch(activeTab, async (newTab) => {
    if (route.query.tab === newTab) return

    await router.replace({ path: '/setting', query: { tab: newTab } })
  })
}
