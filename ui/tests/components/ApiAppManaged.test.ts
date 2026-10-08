import { createRouter, createWebHashHistory } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import ApiApp from '@/ApiApp.vue'
import { apiRequest, setAccessToken, setManagedSession } from '@/api/client'
import type { AccountProfileType } from '@/types/Auth'

vi.mock('@/repositories/v5StateRepository', () => ({ clearServerState: vi.fn() }))
const state = vi.hoisted(() => ({
  token: '',
  pending: false,
  workspaceLeave: vi.fn(),
  aiLeave: vi.fn(),
  profileLeave: vi.fn(),
  loadAppearance: vi.fn(),
  applyAppearance: vi.fn()
}))
vi.mock('@/api/client', () => ({
  apiRequest: vi.fn(),
  refreshAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  setManagedSession: vi.fn((token: string) => {
    state.token = token
  }),
  hasPendingAccountWrites: () => state.pending
}))
vi.mock('@/hooks/api/useAccountAppearance', () => ({
  useAccountAppearance: () => ({
    style: { value: {} },
    clear: vi.fn(),
    load: state.loadAppearance,
    apply: state.applyAppearance
  })
}))
vi.mock('@/components/workspace/WorkspaceSelector.vue', () => ({
  default: { template: '<div />' }
}))
vi.mock('@/views/main/components/LeftMenu.vue', () => ({
  default: {
    template: `<nav><button v-for="item in [['overview','总览'],['score','成绩'],['student-info','学生'],['tools','工具'],['setting','设置']]" @click="$router.push('/'+item[0])">{{item[1]}}</button></nav>`
  }
}))
vi.mock('@/components/ThemeSelector.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/UserAccountMenu.vue', () => ({
  default: {
    props: ['user', 'canSwitch'],
    template:
      '<div class="identity">{{ user.nickname }}<button class="profile-link" @click="$emit(\'profile\')">个人设置</button><button v-if="canSwitch" class="switch-user" @click="$emit(\'switchUser\')">切换用户</button><button class="logout" @click="$emit(\'logout\')">退出登录</button></div>'
  }
}))
vi.mock('@/views/workspace-api/ManagedAccountSelect.vue', () => ({
  default: {
    template:
      '<button class="select-teacher" @click="$emit(\'select\', \'teacher\')">目标老师</button>'
  }
}))
vi.mock('@/views/main/ServerTeachingWorkbench.vue', () => ({
  default: {
    props: ['ownerId'],
    setup: () => ({ canLeave: state.workspaceLeave }),
    template: '<div class="teaching-page">{{ ownerId }} / {{ $route.path.slice(1) }}</div>'
  }
}))
vi.mock('@/views/auth/AISettings.vue', () => ({
  default: {
    setup: () => ({ canLeave: state.aiLeave }),
    template: '<div class="ai-page" />'
  }
}))
vi.mock('@/views/auth/ProfileSettings.vue', () => ({
  default: {
    props: ['user'],
    setup: () => ({ canLeave: state.profileLeave }),
    template:
      '<div class="profile-page">{{ user.nickname }}<button class="revoke" @click="$emit(\'logout\')">密码更新</button></div>'
  }
}))
vi.mock('@/views/auth/AccountManagement.vue', () => ({
  default: { template: '<div class="accounts-page" />' }
}))
vi.mock('@/views/auth/AdminAISettings.vue', () => ({
  default: { setup: () => ({ canLeave: state.aiLeave }), template: '<div />' }
}))
vi.mock('@/views/auth/DeviceSessions.vue', () => ({ default: { template: '<div />' } }))
const admin: AccountProfileType = {
  id: 'admin',
  phone: '13900000000',
  nickname: '管理员',
  role: 'ADMIN',
  status: 'ACTIVE',
  superVip: true,
  mustChangePassword: false,
  version: 1
}
const teacher: AccountProfileType = {
  ...admin,
  id: 'teacher',
  phone: '18800000000',
  nickname: '目标老师',
  role: 'USER',
  superVip: false
}
function mockServer(real = admin): void {
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path === '/setup/status') return { required: false }
    if (path === '/auth/me') return real
    if (path === '/me/context') return state.token || options?.managedToken ? teacher : real
    if (path === '/me/managed-session' && options?.method === 'POST')
      return { token: 'managed-token', user: teacher }
    return { success: true }
  })
}
async function page() {
  const wrapper = mount(ApiApp, {
    global: {
      plugins: [
        ElementPlus,
        createRouter({
          history: createWebHashHistory(),
          routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
        })
      ]
    }
  })
  await flushPromises()
  return wrapper
}
async function switchToTeacher(wrapper: Awaited<ReturnType<typeof page>>) {
  await wrapper.get('.switch-user').trigger('click')
  await flushPromises()
  await wrapper.get('.select-teacher').trigger('click')
  const enter = wrapper.findAll('button').find((button) => button.text() === '进入工作台')!
  await enter.trigger('click')
  await flushPromises()
}
async function navigate(wrapper: Awaited<ReturnType<typeof page>>, label: string) {
  if (label === '个人设置' && wrapper.find('.profile-link').exists()) {
    await wrapper.get('.profile-link').trigger('click')
    await flushPromises()
    return
  }
  await wrapper
    .findAll('nav button')
    .find((button) => button.text() === label)!
    .trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  window.history.replaceState(null, '', '#/home')
  state.token = ''
  state.pending = false
  state.workspaceLeave.mockResolvedValue(true)
  state.aiLeave.mockResolvedValue(true)
  state.profileLeave.mockResolvedValue(true)
  state.loadAppearance.mockImplementation(async (token?: string) => ({
    theme: (token ?? state.token) ? 'green' : 'purple',
    fontFamily: 'system-ui',
    fontSize: 14
  }))
  mockServer()
})
afterEach(() => {
  document.body.innerHTML = ''
})
it('管理员切换后与老师直接登录使用相同菜单、页面、身份，切回来恢复管理员与皮肤', async () => {
  const wrapper = await page()
  expect(wrapper.find('nav').text()).toContain('账号管理')
  await switchToTeacher(wrapper)
  expect(wrapper.get('.identity').text()).toContain('目标老师')
  expect(wrapper.find('header .api-app__managed').text()).toContain('代管：目标老师')
  expect(wrapper.find('.api-app__body .api-app__managed').exists()).toBe(false)
  expect(wrapper.find('nav').text()).not.toContain('账号管理')
  expect(wrapper.find('nav').text()).not.toContain('平台智能')
  expect(wrapper.get('.teaching-page').text()).toBe('teacher / overview')
  expect(sessionStorage.getItem('cms-managed-session')).toBe('managed-token')
  const managedMenu = wrapper.findAll('nav button').map((button) => button.text())
  await navigate(wrapper, '成绩')
  expect(wrapper.get('.teaching-page').text()).toBe('teacher / score')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '返回管理员')!
    .trigger('click')
  await flushPromises()
  expect(wrapper.find('nav').text()).toContain('账号管理')
  expect(wrapper.get('.identity').text()).toContain('管理员')
  expect(state.applyAppearance).toHaveBeenLastCalledWith(
    expect.objectContaining({ theme: 'purple' })
  )
  expect(sessionStorage.getItem('cms-managed-session')).toBeNull()
  wrapper.unmount()
  mockServer(teacher)
  window.history.replaceState(null, '', '#/home')
  const direct = await page()
  expect(direct.findAll('nav button').map((button) => button.text())).toEqual(managedMenu)
  expect(direct.get('.teaching-page').text()).toBe('teacher / overview')
  direct.unmount()
})
it('检查隐藏页面的草稿与所有未结束提交，拒绝切换时保持管理员原工作台', async () => {
  const wrapper = await page()
  await navigate(wrapper, '平台智能')
  await navigate(wrapper, '个人设置')
  state.aiLeave.mockResolvedValue(false)
  await switchToTeacher(wrapper)
  expect(wrapper.get('.identity').text()).toContain('管理员')
  expect(
    vi
      .mocked(apiRequest)
      .mock.calls.some(
        ([path, options]) => path === '/me/managed-session' && options?.method === 'POST'
      )
  ).toBe(false)
  state.aiLeave.mockResolvedValue(true)
  state.pending = true
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '进入工作台')!
    .trigger('click')
  await flushPromises()
  expect(state.token).toBe('')
  wrapper.unmount()
})
it('目标偏好加载失败时结束候选会话，保留管理员页面、皮肤和身份', async () => {
  const wrapper = await page()
  state.loadAppearance.mockRejectedValueOnce(new Error('读取失败'))
  await switchToTeacher(wrapper)
  expect(wrapper.get('.identity').text()).toContain('管理员')
  expect(state.token).toBe('')
  expect(state.applyAppearance).toHaveBeenCalledTimes(1)
  expect(vi.mocked(apiRequest).mock.calls).toContainEqual([
    '/me/managed-session',
    { method: 'DELETE', actorOnly: true }
  ])
  wrapper.unmount()
})
it('刷新恢复有效会话，老师工作台禁止管理员地址，退出注销真实管理员', async () => {
  sessionStorage.setItem('cms-managed-session', 'managed-token')
  window.history.replaceState(null, '', '#/accounts')
  const wrapper = await page()
  expect(wrapper.get('.identity').text()).toContain('目标老师')
  expect(wrapper.get('.teaching-page').text()).toBe('teacher / overview')
  expect(wrapper.find('.accounts-page').exists()).toBe(false)
  await wrapper.get('.logout').trigger('click')
  await flushPromises()
  expect(apiRequest).toHaveBeenCalledWith('/auth/logout', { method: 'POST', actorOnly: true })
  expect(setAccessToken).toHaveBeenCalledWith('')
  expect(setManagedSession).toHaveBeenLastCalledWith('')
  expect(sessionStorage.getItem('cms-managed-session')).toBeNull()
  wrapper.unmount()
})
it('代管失效与目标改密后清理目标工作台并返回管理员，原管理员令牌保留', async () => {
  const wrapper = await page()
  await switchToTeacher(wrapper)
  window.dispatchEvent(new Event('managed-session-invalid'))
  await flushPromises()
  expect(wrapper.get('.identity').text()).toContain('管理员')
  expect(wrapper.find('.api-app__managed').exists()).toBe(false)
  expect(setAccessToken).not.toHaveBeenCalled()
  await switchToTeacher(wrapper)
  await navigate(wrapper, '个人设置')
  await wrapper.get('.revoke').trigger('click')
  await flushPromises()
  expect(wrapper.get('.identity').text()).toContain('管理员')
  expect(setAccessToken).not.toHaveBeenCalled()
  wrapper.unmount()
})
