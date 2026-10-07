import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ElementPlus, { ElSelect } from 'element-plus'
import AIQuotaManager from '@/views/auth/ai/AIQuotaManager.vue'
import { apiRequest, ApiRequestError } from '@/api/client'
import type { AIConfigType } from '@/types/ApiAI'
vi.mock('@/api/client', async (original) => ({
  ...(await original<typeof import('@/api/client')>()),
  apiRequest: vi.fn()
}))
const quota = { available: 100, reserved: 20, used: 30, version: 2 }
const account = {
  id: 'teacher',
  phone: '13800000000',
  nickname: '老师',
  role: 'USER',
  status: 'ACTIVE'
}
const config = {
  configured: true,
  enabled: true,
  model: 'model',
  baseUrl: 'https://example.test',
  provider: 'OPENAI',
  version: 1
} as AIConfigType
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path.startsWith('/admin/ai/quotas')
      ? { items: [{ ...account, ...quota }], total: 1 }
      : path.startsWith('/admin/users?')
        ? { items: [account] }
        : quota
  )
})
afterEach(() => {
  document.body.innerHTML = ''
})
function page(value: AIConfigType | null = config) {
  return mount(AIQuotaManager, {
    attachTo: document.body,
    props: { config: value, disabled: false },
    global: { plugins: [ElementPlus] }
  })
}
it('模型未配置禁用添加，余额列表和扣减仍可用', async () => {
  const wrapper = page(null)
  await flushPromises()
  const add = wrapper.findAll('button').find((item) => item.text() === '添加账号额度')!
  expect(add.attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('请先配置并启用平台模型')
  expect(wrapper.text()).toContain(account.phone)
  expect(
    wrapper
      .findAll('button')
      .find((item) => item.text() === '扣减')!
      .attributes('disabled')
  ).toBeUndefined()
  wrapper.unmount()
})
it('显式添加按钮打开弹窗，选择老师后提交正额度和原因，失败保留输入与幂等键', async () => {
  const wrapper = page()
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((item) => item.text() === '添加账号额度')!
    .trigger('click')
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  const dialog = new DOMWrapper(document.body.querySelector('.el-dialog')!)
  const select = wrapper.findAllComponents(ElSelect).slice(-1)[0]
  select.vm.$emit('update:modelValue', account.id)
  select.vm.$emit('change', account.id)
  await flushPromises()
  const inputs = dialog.findAll('input')
  await inputs[inputs.length - 1].setValue('教学使用')
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('断网'))
  const submit = dialog.findAll('button').find((item) => item.text() === '确认添加')!
  await submit.trigger('click')
  await flushPromises()
  expect(dialog.isVisible()).toBe(true)
  await submit.trigger('click')
  await flushPromises()
  const writes = vi
    .mocked(apiRequest)
    .mock.calls.filter(([, options]) => options?.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[0][1]?.body).toEqual({ delta: 10000, version: 2, reason: '教学使用' })
  expect(writes[1][1]?.idempotencyKey).toBe(writes[0][1]?.idempotencyKey)
  wrapper.unmount()
})
it('版本冲突刷新余额，保留原因，不能自动重复提交', async () => {
  const wrapper = page()
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((item) => item.text() === '追加')!
    .trigger('click')
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await new DOMWrapper(document.body.querySelector('.el-dialog')!)
    .findAll('input')
    .slice(-1)[0]
    .setValue('追加预算')
  vi.mocked(apiRequest).mockRejectedValueOnce(
    new ApiRequestError('VERSION_CONFLICT', '额度已变化', 409)
  )
  await new DOMWrapper(document.body.querySelector('.el-dialog')!)
    .findAll('button')
    .find((item) => item.text() === '确认添加')!
    .trigger('click')
  await flushPromises()
  expect(
    vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === 'POST')
  ).toHaveLength(1)
  expect(
    new DOMWrapper(document.body.querySelector('.el-dialog')!).findAll('input').slice(-1)[0].element
      .value
  ).toBe('追加预算')
  expect(apiRequest).toHaveBeenCalledWith('/admin/users/teacher/ai-quota')
  wrapper.unmount()
})
