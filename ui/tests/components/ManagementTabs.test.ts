import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import AdminAISettings from '@/views/auth/AdminAISettings.vue'
import AISettings from '@/views/auth/AISettings.vue'
import ProfileSettings from '@/views/auth/ProfileSettings.vue'
import { apiRequest } from '@/api/client'
import type { AccountProfileType } from '@/types/Auth'

const { canLeave } = vi.hoisted(() => ({ canLeave: vi.fn() }))
vi.mock('@/api/client', () => ({ apiRequest: vi.fn(), setAccessToken: vi.fn() }))
vi.mock('@/hooks/api/useAISettingsLeave', () => ({ useAISettingsLeave: () => ({ canLeave }) }))
vi.mock('@/components/ThemeSelector.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/ai/AIProviderForm.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/ai/AICallMonitor.vue', () => ({ default: { template: '<div />' } }))
const profile: AccountProfileType = {
  id: 'user',
  phone: '13800000000',
  nickname: '测试',
  role: 'ADMIN',
  status: 'ACTIVE',
  version: 1,
  superVip: false,
  mustChangePassword: false
}
beforeEach(() => {
  vi.clearAllMocks()
  canLeave.mockResolvedValue(true)
  const config = {
    provider: 'OPENAI',
    baseUrl: '',
    model: '',
    enabled: false,
    configured: false,
    version: 1
  }
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/me/ai'
      ? {
          mode: 'PLATFORM',
          platform: config,
          personal: config,
          quota: { available: 0, reserved: 0, used: 0 },
          version: 1
        }
      : path.startsWith('/admin/users')
        ? { items: [], total: 0 }
        : config
  )
})
it('平台 AI 页按功能分栏，切换保留草稿离开检查', async () => {
  const wrapper = mount(AdminAISettings, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  const tabs = wrapper.findAll('[role="tab"]')
  expect(tabs.map((tab) => tab.text())).toEqual(['模型配置', '账号额度', '调用记录'])
  canLeave.mockResolvedValueOnce(false)
  await tabs[1].trigger('click')
  await flushPromises()
  expect(tabs[0].attributes('aria-selected')).toBe('true')
  expect(canLeave).toHaveBeenCalledOnce()
  await tabs[1].trigger('click')
  await flushPromises()
  expect(tabs[1].attributes('aria-selected')).toBe('true')
  wrapper.unmount()
})
it('个人 AI 页分栏切换也执行离开检查', async () => {
  const wrapper = mount(AISettings, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  const tabs = wrapper.findAll('[role="tab"]')
  expect(tabs.map((tab) => tab.text())).toEqual(['使用方式与额度', '个人密钥配置'])
  canLeave.mockResolvedValueOnce(false)
  await tabs[1].trigger('click')
  await flushPromises()
  expect(tabs[0].attributes('aria-selected')).toBe('true')
  wrapper.unmount()
})
it('个人设置按资料、安全、代管分栏，首登仅开放密码安全', async () => {
  const normal = mount(ProfileSettings, {
    props: { user: profile },
    global: { plugins: [ElementPlus] }
  })
  expect(normal.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
    '账号资料',
    '密码安全',
    '账号代管'
  ])
  normal.unmount()
  const initial = mount(ProfileSettings, {
    props: { user: { ...profile, mustChangePassword: true } },
    global: { plugins: [ElementPlus] }
  })
  expect(initial.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['密码安全'])
  expect(initial.find('[role="tab"]').attributes('aria-selected')).toBe('true')
  initial.unmount()
})
