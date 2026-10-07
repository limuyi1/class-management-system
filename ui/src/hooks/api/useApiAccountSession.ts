import { clearServerState } from '@/repositories/v5StateRepository'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest, refreshAccessToken, setAccessToken, setManagedSession } from '@/api/client'
import { useAccountAppearance } from './useAccountAppearance'
import type { AccountProfileType } from '@/types/Auth'
import type { SetupStatusType } from '../../../../packages/shared/src/Setup'

/** 复用真实登录会话，切换有效用户后由同一工作台展示目标内容。 */
export function useApiAccountSession(options: {
  beforeLeave: () => Promise<boolean>
  navigating: () => boolean
  activatePage: (page: string) => void
}) {
  const appearance = useAccountAppearance()
  const actor = ref<AccountProfileType | null>(null)
  const user = ref<AccountProfileType | null>(null)
  const managed = ref(false)
  const contextKey = ref(0)
  const switching = ref(false)
  const switchDialog = ref(false)
  const candidate = ref('')
  const loading = ref(true)
  const setup = ref<SetupStatusType | null>(null)
  const startupError = ref('')
  const setupPhone = ref('')
  function setupFinished(phone: string): void {
    setupPhone.value = phone
    setup.value = { required: false, available: false }
  }
  function rememberManaged(token: string): void {
    try {
      if (token) sessionStorage.setItem('cms-managed-session', token)
      else sessionStorage.removeItem('cms-managed-session')
    } catch {
      /* 受限浏览器仍支持本次会话切换。 */
    }
  }
  /** 重建同一套工作台，销毁旧账号的页面缓存和临时状态。 */
  function activate(profile: AccountProfileType, token = '', page = ''): void {
    clearServerState()
    if (!page)
      page = profile.mustChangePassword
        ? 'profile'
        : profile.role === 'ADMIN'
          ? 'accounts'
          : 'overview'
    setManagedSession(token)
    rememberManaged(token)
    managed.value = Boolean(token)
    user.value = profile
    contextKey.value++
    options.activatePage(page)
  }
  async function onLogin(profile: AccountProfileType): Promise<void> {
    actor.value = profile
    appearance.clear()
    switching.value = true
    try {
      activate(profile)
      await loadAppearance()
    } finally {
      switching.value = false
    }
  }
  async function loadAppearance(): Promise<void> {
    if (user.value?.mustChangePassword) return
    try {
      appearance.apply(await appearance.load())
    } catch (error) {
      console.error('读取账号皮肤失败:', error)
    }
  }
  async function reloadUser(): Promise<void> {
    user.value = await apiRequest<AccountProfileType>('/me/context')
    actor.value = await apiRequest<AccountProfileType>('/auth/me', { actorOnly: true })
  }
  async function openSwitch(): Promise<void> {
    if (!actor.value?.superVip || managed.value) return
    candidate.value = ''
    switchDialog.value = true
  }
  async function switchAccount(): Promise<void> {
    if (
      !candidate.value ||
      candidate.value === actor.value?.id ||
      switching.value ||
      options.navigating()
    )
      return
    switching.value = true
    try {
      if (!(await options.beforeLeave())) return
      const result = await apiRequest<{ token: string; user: AccountProfileType }>(
        '/me/managed-session',
        {
          method: 'POST',
          actorOnly: true,
          body: { ownerId: candidate.value }
        }
      )
      let preferences
      try {
        preferences = result.user.mustChangePassword
          ? { theme: 'bluepink' as const, fontFamily: 'system-ui', fontSize: 14 }
          : await appearance.load(result.token)
      } catch (error) {
        await apiRequest('/me/managed-session', { method: 'DELETE', actorOnly: true })
        throw error
      }
      appearance.clear()
      activate(result.user, result.token)
      appearance.apply(preferences)
      switchDialog.value = false
      ElMessage.success(`已切换到${result.user.nickname}的教学工作台`)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '切换失败')
    } finally {
      switching.value = false
    }
  }
  /** 失效会话立即销毁目标数据；正常返回则先检查所有页面草稿。 */
  async function returnAdmin(force = false): Promise<void> {
    if (switching.value && !force) return
    switching.value = true
    try {
      if (!force && !(await options.beforeLeave())) return
      if (force) {
        loading.value = true
        appearance.clear()
        setManagedSession('')
        rememberManaged('')
        user.value = null
        contextKey.value++
      }
      const real = await apiRequest<AccountProfileType>('/auth/me', { actorOnly: true })
      const preferences = real.mustChangePassword
        ? { theme: 'bluepink' as const, fontFamily: 'system-ui', fontSize: 14 }
        : await appearance.load('')
      await apiRequest('/me/managed-session', { method: 'DELETE', actorOnly: true })
      actor.value = real
      appearance.clear()
      activate(real, '', real.mustChangePassword ? 'profile' : 'accounts')
      appearance.apply(preferences)
      if (force) ElMessage.warning('代管会话已结束，已返回管理员')
    } catch (error) {
      if (force) {
        clearLogin()
        ElMessage.error('登录已失效，请重新登录')
      } else ElMessage.error(error instanceof Error ? error.message : '返回失败')
    } finally {
      switching.value = false
      if (force) loading.value = false
    }
  }
  function clearLogin(): void {
    clearServerState()
    appearance.clear()
    setManagedSession('')
    rememberManaged('')
    setAccessToken('')
    user.value = actor.value = null
    managed.value = false
    contextKey.value++
  }
  async function identityRevoked(): Promise<void> {
    if (managed.value) await returnAdmin(true)
    else clearLogin()
  }
  async function logout(): Promise<void> {
    if (switching.value || options.navigating() || !(await options.beforeLeave())) return
    try {
      await apiRequest('/auth/logout', { method: 'POST', actorOnly: true })
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '退出失败，请重试')
      return
    }
    clearLogin()
  }
  async function initialize(): Promise<void> {
    loading.value = true
    startupError.value = ''
    try {
      setup.value = await apiRequest<SetupStatusType>('/setup/status', { actorOnly: true }, false)
      if (!setup.value.required) {
        try {
          await refreshAccessToken()
          const real = await apiRequest<AccountProfileType>('/auth/me', { actorOnly: true })
          actor.value = real
          let token = ''
          try {
            token = sessionStorage.getItem('cms-managed-session') || ''
          } catch {
            /* 无会话恢复。 */
          }
          let effective = real
          if (token) {
            try {
              effective = await apiRequest<AccountProfileType>('/me/context', {
                managedToken: token
              })
            } catch {
              token = ''
            }
          }
          activate(effective, token, window.location.hash.slice(2) || 'home')
          await loadAppearance()
        } catch {
          clearLogin()
        }
      }
    } catch (error) {
      startupError.value = error instanceof Error ? error.message : '无法连接服务器'
    } finally {
      loading.value = false
    }
  }
  function managedInvalid(): void {
    if (managed.value) void returnAdmin(true)
  }
  let contextTimer: ReturnType<typeof setInterval> | undefined
  /** 定时及恢复页面焦点时校验目标状态，失效后清除目标缓存。 */
  async function validateManagedContext(): Promise<void> {
    if (!managed.value || switching.value || options.navigating()) return
    try {
      await apiRequest('/me/context')
    } catch (error) {
      console.error('校验代管会话失败:', error)
    }
  }
  function appearanceUpdated(): void {
    void loadAppearance()
  }
  onMounted(() => {
    contextTimer = setInterval(() => void validateManagedContext(), 30000)
    window.addEventListener('focus', validateManagedContext)
    window.addEventListener('managed-session-invalid', managedInvalid)
    window.addEventListener('account-appearance-updated', appearanceUpdated)
    void initialize()
  })
  onBeforeUnmount(() => {
    clearInterval(contextTimer)
    window.removeEventListener('focus', validateManagedContext)
    window.removeEventListener('managed-session-invalid', managedInvalid)
    window.removeEventListener('account-appearance-updated', appearanceUpdated)
  })

  return {
    appearance,
    actor,
    user,
    managed,
    contextKey,
    switching,
    switchDialog,
    candidate,
    loading,
    setup,
    startupError,
    setupPhone,
    setupFinished,
    onLogin,
    reloadUser,
    openSwitch,
    switchAccount,
    returnAdmin,
    identityRevoked,
    logout,
    initialize
  }
}
