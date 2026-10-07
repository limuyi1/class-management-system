import { onScopeDispose, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import { useThemeStore } from '@/stores/theme'
import { defaultTheme, themes } from '@/config/theme'
import type { ThemeName } from '@/config/theme'

export interface AccountAppearanceType {
  theme: ThemeName
  fontFamily: string
  fontSize: number
}

/** 皮肤与字体保存到当前有效账号，切换时载入完整偏好再开放页面。 */
export function useAccountAppearance() {
  const theme = useThemeStore()
  const style = ref({ fontFamily: 'system-ui', fontSize: '14px' })
  let applying = false
  let active = false
  let alive = true
  let version = 0
  const load = (managedToken?: string) =>
    apiRequest<AccountAppearanceType>('/me/appearance', { managedToken })
  function apply(value: AccountAppearanceType): void {
    applying = true
    theme.setTheme(
      Object.prototype.hasOwnProperty.call(themes, value.theme) ? value.theme : defaultTheme
    )
    style.value = {
      fontFamily: value.fontFamily || 'system-ui',
      fontSize: `${value.fontSize || 14}px`
    }
    applying = false
    active = true
    version++
  }
  function clear(): void {
    active = false
    version++
  }
  watch(
    () => theme.currentTheme,
    async (value, previous) => {
      if (!active || applying) return
      const current = version
      try {
        await apiRequest('/me/appearance', {
          method: 'PATCH',
          body: { theme: value },
          idempotencyKey: crypto.randomUUID()
        })
      } catch (error) {
        if (!alive || current !== version) return
        applying = true
        theme.setTheme(previous)
        applying = false
        ElMessage.error(error instanceof Error ? error.message : '皮肤保存失败')
      }
    },
    { flush: 'sync' }
  )
  onScopeDispose(() => {
    alive = false
    clear()
  })
  return { style, load, apply, clear }
}
