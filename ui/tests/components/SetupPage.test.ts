import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import SetupPage from '@/views/auth/SetupPage.vue'
import { apiRequest } from '@/api/client'
vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
const stubs = {
  ElForm: { template: '<form @submit.prevent="$emit(\'submit\', $event)"><slot /></form>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElInput: {
    props: ['modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  ElButton: {
    emits: ['click'],
    props: ['nativeType'],
    template: '<button :type="nativeType || \'button\'" @click="$emit(\'click\')"><slot /></button>'
  },
  ElAlert: { props: ['title'], template: '<p>{{ title }}</p>' }
}
const page = (available = true) => mount(SetupPage, { props: { available }, global: { stubs } })
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockResolvedValue({ user: { id: 'admin' } })
})
it('填写手机号即可创建，默认随机密码可复制，保存后进入登录', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const wrapper = page()
  await wrapper.get('input[autocomplete="username"]').setValue('13800000000')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  const [, options, retry] = vi.mocked(apiRequest).mock.calls[0]!
  const body = options!.body as { phone: string; initialPassword: string }
  expect(body.phone).toBe('13800000000')
  expect(body.initialPassword.length).toBeGreaterThanOrEqual(15)
  expect(retry).toBe(false)
  expect(wrapper.get('input[aria-label="临时密码"]').element.value).toBe(body.initialPassword)
  await wrapper.get('.setup-page__copy').trigger('click')
  expect(writeText).toHaveBeenCalledWith(body.initialPassword)
  await wrapper.get('.login-page__submit').trigger('click')
  expect(wrapper.emitted('initialized')).toEqual([['13800000000']])
  expect(apiRequest).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
it('无效手机号不提交，网络失败重试保留原密码与请求键', async () => {
  const wrapper = page()
  await wrapper.get('form').trigger('submit')
  expect(apiRequest).not.toHaveBeenCalled()
  await wrapper.get('input[autocomplete="username"]').setValue('13800000000')
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('网络中断'))
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toBe('网络中断')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(vi.mocked(apiRequest).mock.calls[1]).toEqual(vi.mocked(apiRequest).mock.calls[0])
  wrapper.unmount()
})
it('不允许远程初始化时仅提示本机设置，退出后忽略晚到结果', async () => {
  const unavailable = page(false)
  expect(unavailable.find('form').exists()).toBe(false)
  expect(unavailable.text()).toContain('服务器本机')
  unavailable.unmount()
  let resolve!: (value: unknown) => void
  vi.mocked(apiRequest).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const wrapper = page()
  await wrapper.get('input[autocomplete="username"]').setValue('13800000000')
  await wrapper.get('form').trigger('submit')
  wrapper.unmount()
  resolve({ user: { id: 'admin' } })
  await flushPromises()
  expect(wrapper.emitted('initialized')).toBeUndefined()
})
