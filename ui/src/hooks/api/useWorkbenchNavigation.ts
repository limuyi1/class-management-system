import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Ref } from 'vue'
import type { AccountProfileType } from '@/types/Auth'

/** 老师菜单沿用 V5 原入口，管理员独立菜单；权限来自有效用户。 */
export function useWorkbenchNavigation(
  user: Ref<AccountProfileType | null>,
  beforeLeave: () => Promise<boolean>,
  switching: () => boolean
) {
  const router = useRouter()
  const teachingKeys = ['overview', 'score', 'student-info', 'tools', 'setting']
  const common = [
    { key: 'devices', label: '登录设备', icon: 'circle-info', subtitle: '管理当前用户的设备访问' },
    { key: 'profile', label: '个人设置', icon: 'user-pen', subtitle: '管理账号资料与密码安全' }
  ]
  const teacherItems = [
    { key: 'overview', label: '总览', icon: 'chart-line', subtitle: '' },
    { key: 'score', label: '成绩', icon: 'graduation-cap', subtitle: '' },
    { key: 'student-info', label: '学生', icon: 'user', subtitle: '' },
    { key: 'tools', label: '工具', icon: 'toolbox', subtitle: '' },
    { key: 'setting', label: '设置', icon: 'gear', subtitle: '' }
  ]
  const tab = ref('profile'),
    teachingPage = ref('overview'),
    visited = ref(new Set<string>())
  const navigating = ref(false),
    contentScroll = ref<{ setScrollTop: (top: number) => void }>()
  const menuItems = computed(() =>
    user.value?.mustChangePassword
      ? common.filter((item) => item.key === 'profile')
      : user.value?.role === 'ADMIN'
        ? [
            {
              key: 'accounts',
              label: '账号管理',
              icon: 'user-group',
              subtitle: '管理老师账号与登录权限'
            },
            {
              key: 'admin-ai',
              label: '平台智能',
              icon: 'star',
              subtitle: '统一模型配置、额度分配与调用核对'
            },
            ...common
          ]
        : teacherItems
  )
  const activePage = computed(() =>
    [...menuItems.value, ...common].find((item) => item.key === tab.value)
  )
  function normalized(key: string): string {
    const path = key.split('?')[0] || ''
    const aliases: Record<string, string> = {
      home: 'overview',
      students: 'student-info',
      scores: 'score',
      teaching: 'tools/comments',
      advanced: 'tools',
      attachments: 'tools/attachments',
      ai: 'setting?tab=ai-config'
    }
    return aliases[path] || key
  }
  function allowed(key: string): boolean {
    const path = key.split('?')[0] || ''
    if (user.value?.mustChangePassword) return path === 'profile'
    if (user.value?.role === 'ADMIN') return menuItems.value.some((item) => item.key === path)
    return (
      teachingKeys.includes(path) ||
      path.startsWith('tools/') ||
      common.some((item) => item.key === path)
    )
  }
  async function setPage(key: string, replace = false): Promise<void> {
    key = normalized(key)
    if (!allowed(key))
      key = user.value?.mustChangePassword
        ? 'profile'
        : user.value?.role === 'ADMIN'
          ? 'accounts'
          : 'overview'
    const path = key.split('?')[0] || ''
    tab.value = path.startsWith('tools/') ? 'tools' : path
    if (teachingKeys.includes(tab.value)) teachingPage.value = tab.value
    visited.value.add(tab.value)
    await router[replace ? 'replace' : 'push'](`/${key}`)
  }
  async function selectPage(key: string): Promise<void> {
    if (switching() || navigating.value) return
    navigating.value = true
    try {
      if (await beforeLeave()) {
        await setPage(key)
        await nextTick()
        contentScroll.value?.setScrollTop(0)
      }
    } finally {
      navigating.value = false
    }
  }
  function resetPage(page: string): void {
    visited.value = new Set()
    void setPage(page, true)
  }
  const removeAfter = router.afterEach((to, _from, failure) => {
    if (failure) return
    const path = to.path.slice(1)
    tab.value = path.startsWith('tools/') ? 'tools' : path
    visited.value.add(tab.value)
  })
  const removeGuard = router.beforeEach(async (to) => {
    if (!user.value) return true
    if (to.path === '/' || to.path === '/main')
      return user.value.mustChangePassword
        ? '/profile'
        : user.value.role === 'ADMIN'
          ? '/accounts'
          : '/overview'
    const alias = normalized(to.fullPath.slice(1))
    if (alias !== to.fullPath.slice(1)) return `/${alias}`
    if (!allowed(to.fullPath.slice(1)))
      return user.value.mustChangePassword
        ? '/profile'
        : user.value.role === 'ADMIN'
          ? '/accounts'
          : '/overview'
    if (!navigating.value && !(await beforeLeave())) return false
    return true
  })
  onBeforeUnmount(() => {
    removeGuard()
    removeAfter()
  })
  return {
    teachingKeys,
    tab,
    teachingPage,
    visited,
    navigating,
    contentScroll,
    menuItems,
    activePage,
    selectPage,
    resetPage
  }
}
