import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ElementPlus, { ElInput, ElSelect } from 'element-plus'
import AIProviderForm from '@/views/auth/ai/AIProviderForm.vue'
import { apiRequest } from '@/api/client'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
const config = {
  provider: 'OPENAI' as const,
  baseUrl: 'https://models.example.test/v1',
  model: 'manual-model',
  apiKey: 'saved-key',
  configured: true,
  enabled: true,
  version: 1
}
beforeEach(() => vi.clearAllMocks())
it('刷新图标使用密码框回填的 Key 获取模型，保留手填名称且不保存配置', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ items: ['model-a', 'model-b'] })
  const wrapper = mount(AIProviderForm, {
    props: { config, platform: true },
    global: { plugins: [ElementPlus] }
  })
  const refresh = wrapper.get('button[aria-label="刷新模型"]')
  expect(refresh.text()).toBe('')
  await refresh.trigger('click')
  await flushPromises()
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith('/admin/ai/models', {
    method: 'POST',
    body: { provider: 'OPENAI', baseUrl: config.baseUrl, apiKey: 'saved-key' }
  })
  const model = wrapper.findAllComponents(ElSelect)[1]
  expect(model.props('allowCreate')).toBe(true)
  expect(model.props('modelValue')).toBe('manual-model')
  expect(wrapper.emitted('busy')).toEqual([[true], [false]])
  expect(wrapper.emitted('saved')).toBeUndefined()
  wrapper.unmount()
})
it('个人配置支持用草稿地址和新 Key 刷新，失败后仍保留当前模型', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new Error('目录请求失败'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const wrapper = mount(AIProviderForm, { props: { config }, global: { plugins: [ElementPlus] } })
  const inputs = wrapper.findAllComponents(ElInput)
  inputs[0].vm.$emit('update:modelValue', 'https://new.example.test/v1')
  inputs[1].vm.$emit('update:modelValue', 'new-key')
  await flushPromises()
  await wrapper.get('button[aria-label="刷新模型"]').trigger('click')
  await flushPromises()
  expect(apiRequest).toHaveBeenCalledWith('/me/ai/models', {
    method: 'POST',
    body: { provider: 'OPENAI', baseUrl: 'https://new.example.test/v1', apiKey: 'new-key' }
  })
  expect(wrapper.findAllComponents(ElSelect)[1].props('modelValue')).toBe('manual-model')
  expect(wrapper.emitted('busy')).toEqual([[true], [false]])
  wrapper.unmount()
  log.mockRestore()
})

it.each(['replacement-key', ''])(
  '密码框直接保存当前值 %s，回填不被误判为未保存草稿',
  async (value) => {
    vi.mocked(apiRequest).mockResolvedValue({})
    const wrapper = mount(AIProviderForm, {
      props: { config, platform: true },
      global: { plugins: [ElementPlus] }
    })
    const keyInput = wrapper.findAllComponents(ElInput)[1]
    expect(keyInput.props('modelValue')).toBe('saved-key')
    expect(keyInput.props('type')).toBe('password')
    expect(keyInput.props('showPassword')).toBe(true)
    expect(wrapper.text()).not.toContain('清除旧 Key')
    expect(wrapper.vm.hasDraft).toBe(false)
    keyInput.vm.$emit('update:modelValue', value)
    await flushPromises()
    expect(wrapper.vm.hasDraft).toBe(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存配置')!
      .trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/ai/config',
      expect.objectContaining({
        method: 'PUT',
        body: {
          provider: 'OPENAI',
          baseUrl: config.baseUrl,
          model: config.model,
          enabled: Boolean(value),
          version: 1,
          apiKey: value || null
        }
      })
    )
    expect(keyInput.props('modelValue')).toBe(value)
    await wrapper.setProps({
      config: { ...config, apiKey: value, enabled: Boolean(value), version: 2 }
    })
    expect(wrapper.vm.hasDraft).toBe(false)
    wrapper.unmount()
  }
)
