import { createRouter, createWebHashHistory } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import ApiApp from '@/ApiApp.vue'
import { apiRequest } from '@/api/client'

vi.mock('@/repositories/v5StateRepository', () => ({ clearServerState: vi.fn() }))
const { canLeave } = vi.hoisted(() => ({ canLeave: vi.fn() }))
vi.mock('@/api/client', () => ({
  apiRequest: vi.fn(),
  refreshAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  setManagedSession: vi.fn(),
  hasPendingAccountWrites: vi.fn(() => false)
}))
vi.mock('@/hooks/api/useAccountAppearance', () => ({
  useAccountAppearance: () => ({
    style: { value: {} },
    apply: vi.fn(),
    load: vi.fn(),
    clear: vi.fn()
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
vi.mock('@/components/ThemeMenu.vue', () => ({
  default: { template: '<div class="skin-selector" />' }
}))
vi.mock('@/views/auth/ProfileSettings.vue', () => ({
  default: { template: '<div class="profile-page" />' }
}))
vi.mock('@/views/auth/AccountManagement.vue', () => ({
  default: { template: '<div class="accounts-page" />' }
}))
vi.mock('@/views/main/ServerTeachingWorkbench.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/DeviceSessions.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/AISettings.vue', () => ({
  default: { setup: () => ({ canLeave }), template: '<div class="ai-page" />' }
}))
vi.mock('@/views/auth/AdminAISettings.vue', () => ({
  default: { setup: () => ({ canLeave }), template: '<div class="admin-ai-page" />' }
}))

async function page(role = 'ADMIN', mustChangePassword = false) {
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/setup/status'
      ? { required: false, available: false }
      : { id: 'test', nickname: '测试', phone: '13800000000', role, mustChangePassword }
  )
  window.history.replaceState(null, '', '#/profile')
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
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '#/home')
  sessionStorage.clear()
  canLeave.mockResolvedValue(true)
})
it('管理员左侧显示管理菜单，切换后右侧呈现对应内容', async () => {
  const wrapper = await page()
  expect(wrapper.find('aside nav').text()).toContain('账号管理')
  expect(wrapper.find('.skin-selector').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('管理工作台')
  expect(wrapper.text()).not.toContain('让班务管理更轻松')
  const collapse = wrapper.get('button[aria-label="折叠菜单"]')
  expect(collapse.element.closest('.el-scrollbar')).toBeNull()
  await collapse.trigger('click')
  expect(wrapper.find('.left-menu').classes()).toContain('collapsed')
  await wrapper.get('button[aria-label="展开菜单"]').trigger('click')
  expect(wrapper.find('.left-menu').classes()).not.toContain('collapsed')
  await wrapper
    .findAll('nav button')
    .find((button) => button.text() === '账号管理')!
    .trigger('click')
  await flushPromises()
  expect(wrapper.get('.accounts-page').isVisible()).toBe(true)
  expect(wrapper.get('.profile-page').attributes('style')).toContain('display: none')
  expect(wrapper.find('[aria-current="page"]').text()).toBe('账号管理')
  wrapper.unmount()
})
it('老师菜单不显示管理员页面，首登改密仅允许个人设置', async () => {
  const teacher = await page('USER')
  expect(teacher.find('nav').text()).not.toContain('账号管理')
  expect(teacher.find('nav').text()).not.toContain('平台智能')
  teacher.unmount()
  const initial = await page('USER', true)
  expect(initial.findAll('nav button')).toHaveLength(1)
  expect(initial.find('nav').text()).toBe('个人设置')
  initial.unmount()
})
it.each(['平台智能'])('离开%s时遵循草稿检查，拒绝后保留当前页面', async (label) => {
  const wrapper = await page()
  const menu = (text: string) =>
    wrapper.findAll('nav button').find((button) => button.text() === text)!
  await menu(label).trigger('click')
  await flushPromises()
  canLeave.mockClear()
  canLeave.mockResolvedValueOnce(false)
  await menu('个人设置').trigger('click')
  await flushPromises()
  expect(canLeave).toHaveBeenCalledOnce()
  expect(wrapper.find('[aria-current="page"]').text()).toBe(label)
  await menu('个人设置').trigger('click')
  await flushPromises()
  expect(wrapper.find('[aria-current="page"]').text()).toBe('个人设置')
  wrapper.unmount()
})
