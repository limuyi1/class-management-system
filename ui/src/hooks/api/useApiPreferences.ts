import { onScopeDispose, ref, watch } from 'vue'
import { apiRequest } from '@/api/client'
import type { ResourceType } from '@/types/ApiResources'
/** 账号业务字体独立于操作者主题；切换后立即清空且拒收旧响应。 */
export function useApiPreferences(owner: () => string) {
  const accountStyle = ref<{ fontFamily?: string; fontSize?: string }>({})
  let epoch = 0,
    alive = true
  async function load(): Promise<void> {
    const scope = owner(),
      current = ++epoch
    try {
      const data = await apiRequest<{ items: ResourceType[] }>('/resources?kind=settings', {
        ownerId: scope
      })
      if (!alive || current !== epoch || scope !== owner()) return
      const value = data.items[0]?.content
      accountStyle.value = {
        fontFamily: String(value?.fontFamily || 'system-ui'),
        fontSize: `${Number(value?.fontSize || 14)}px`
      }
    } catch (error) {
      console.error('读取账号版式失败:', error)
    }
  }
  watch(
    owner,
    () => {
      accountStyle.value = {}
      void load()
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    alive = false
    epoch++
    accountStyle.value = {}
  })
  return { accountStyle, load }
}
