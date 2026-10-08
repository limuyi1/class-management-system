import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ElementPlus, { ElInput, ElSelect } from 'element-plus'
import AdminAISettings from '@/views/auth/AdminAISettings.vue'
import { apiRequest } from '@/api/client'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
vi.mock('@/views/auth/ai/AIQuotaManager.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/auth/ai/AICallMonitor.vue', () => ({ default: { template: '<div />' } }))
const config = {
  provider: 'OPENAI',
  baseUrl: 'http://localhost:11434/v1',
  model: 'old-model',
  apiKey: 'old-key',
  enabled: true,
  configured: true,
  version: 1
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockResolvedValue(config)
})
afterEach(() => vi.restoreAllMocks())
it('填写未保存内容后禁用配置刷新，保留地址、模型和 Key，保存后恢复刷新', async () => {
  const wrapper = mount(AdminAISettings, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  const inputs = wrapper.findAllComponents(ElInput)
  inputs[0].vm.$emit('update:modelValue', 'http://localhost:8080/v1')
  inputs[1].vm.$emit('update:modelValue', 'new-key')
  wrapper.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', 'new-model')
  await flushPromises()
  const refresh = wrapper.findAll('button').find((button) => button.text() === '刷新平台配置')!
  expect(refresh.attributes('disabled')).toBeDefined()
  await refresh.trigger('click')
  expect(apiRequest).toHaveBeenCalledTimes(1)
  expect(inputs[0].props('modelValue')).toBe('http://localhost:8080/v1')
  expect(inputs[1].props('modelValue')).toBe('new-key')
  expect(wrapper.findAllComponents(ElSelect)[1].props('modelValue')).toBe('new-model')
  expect(wrapper.find('.ai-provider-form__action-row').text()).toContain('启用')
  expect(wrapper.find('.ai-provider-form__action-row').text()).toContain('保存配置')
  vi.mocked(apiRequest).mockImplementation(async (_path, options) =>
    options?.method === 'PUT'
      ? {}
      : {
          ...config,
          baseUrl: 'http://localhost:8080/v1',
          apiKey: 'new-key',
          model: 'new-model',
          version: 2
        }
  )
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '保存配置')!
    .trigger('click')
  await flushPromises()
  expect(refresh.attributes('disabled')).toBeUndefined()
  expect(inputs[1].props('modelValue')).toBe('new-key')
  wrapper.unmount()
})
it('刷新期间锁定表单，刷新失败后保留原配置和 Key', async () => {
  const wrapper = mount(AdminAISettings, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  let rejectRequest!: (error: Error) => void
  vi.mocked(apiRequest).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject
      })
  )
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '刷新平台配置')!
    .trigger('click')
  await flushPromises()
  expect(wrapper.findAllComponents(ElInput)[0].get('input').attributes('disabled')).toBeDefined()
  rejectRequest(new Error('连接失败'))
  await flushPromises()
  expect(wrapper.findAllComponents(ElInput)[1].props('modelValue')).toBe('old-key')
  expect(wrapper.findAllComponents(ElSelect)[1].props('modelValue')).toBe('old-model')
  expect(wrapper.findAllComponents(ElInput)[0].get('input').attributes('disabled')).toBeUndefined()
  wrapper.unmount()
  log.mockRestore()
})
