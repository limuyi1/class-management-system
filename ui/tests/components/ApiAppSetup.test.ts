import { createRouter, createWebHashHistory } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ApiApp from '@/ApiApp.vue'
import { apiRequest, refreshAccessToken } from '@/api/client'
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
vi.mock('@/views/auth/LoginPage.vue', () => ({
  default: { props: ['initialPhone'], template: '<p class="login">登录 {{ initialPhone }}</p>' }
}))
vi.mock('@/views/auth/SetupPage.vue', () => ({
  default: {
    props: ['available'],
    template:
      '<button class="setup" @click="$emit(\'initialized\', \'13800000000\')">首次设置</button>'
  }
}))
vi.mock('@/views/auth/ProfileSettings.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/AccountManagement.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/main/ServerTeachingWorkbench.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/DeviceSessions.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/AISettings.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/AdminAISettings.vue', () => ({ default: { template: '<div />' } }))
const page = () =>
  mount(ApiApp, {
    global: {
      plugins: [
        createRouter({
          history: createWebHashHistory(),
          routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
        })
      ],
      stubs: { ElButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' } }
    }
  })
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '#/home')
  sessionStorage.clear()
  vi.mocked(refreshAccessToken).mockRejectedValue(new Error('未登录'))
})
it('无管理员进入设置，完成后手机号自动带入登录且不自动登录', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ required: true, available: true })
  const wrapper = page()
  await flushPromises()
  expect(wrapper.find('.setup').exists()).toBe(true)
  expect(refreshAccessToken).not.toHaveBeenCalled()
  await wrapper.get('.setup').trigger('click')
  expect(wrapper.get('.login').text()).toContain('13800000000')
  wrapper.unmount()
})
it('已有管理员进入登录，不显示首次设置', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ required: false, available: true })
  const wrapper = page()
  await flushPromises()
  expect(wrapper.find('.login').exists()).toBe(true)
  expect(wrapper.find('.setup').exists()).toBe(false)
  wrapper.unmount()
})
it('服务器异常不误判首次使用，可重试连接', async () => {
  vi.mocked(apiRequest)
    .mockRejectedValueOnce(new Error('无法连接服务器'))
    .mockResolvedValue({ required: false, available: true })
  const wrapper = page()
  await flushPromises()
  expect(wrapper.text()).toContain('无法连接服务器')
  expect(wrapper.find('.setup').exists()).toBe(false)
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.find('.login').exists()).toBe(true)
  wrapper.unmount()
})
