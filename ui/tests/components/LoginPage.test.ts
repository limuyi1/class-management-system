import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import LoginPage from '@/views/auth/LoginPage.vue'
import SliderCaptcha from '@/views/auth/components/SliderCaptcha.vue'
import { apiRequest, setAccessToken } from '@/api/client'
vi.mock('@/api/client', () => ({ apiRequest: vi.fn(), setAccessToken: vi.fn() }))
const stubs = {
  ElForm: { template: '<form @submit.prevent="$emit(\'submit\', $event)"><slot /></form>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElInput: {
    props: ['modelValue', 'type'],
    template:
      '<input :type="type || \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  ElButton: {
    props: ['nativeType'],
    template: '<button :type="nativeType || \'button\'" @click="$emit(\'click\')"><slot /></button>'
  },
  ElDialog: {
    props: ['modelValue'],
    template:
      '<section v-if="modelValue" role="dialog"><button class="close" @click="$emit(\'update:modelValue\', false); $emit(\'close\')">关闭</button><slot /></section>'
  },
  ElSlider: { name: 'ElSlider', props: ['modelValue'], template: '<div class="slider" />' }
}
const createPage = () => mount(LoginPage, { global: { stubs } })
async function fill(wrapper: ReturnType<typeof createPage>): Promise<void> {
  await wrapper.get('input[autocomplete="username"]').setValue('13800000000')
  await wrapper.get('input[type="password"]').setValue('valid-long-password')
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path.endsWith('/challenges'))
      return {
        challengeId: 'challenge',
        image: 'data:image/svg+xml;base64,test',
        width: 320,
        height: 160,
        pieceSize: 48,
        pieceY: 56,
        piecePath: 'M0 0H48V48H0Z'
      }
    if (path.endsWith('/verify')) return { ticket: 'single-use-ticket' }
    return { accessToken: 'access', user: { id: 'teacher' } }
  })
})
/** 输入完成后点击登录先弹验证，移动位置不登录，释放并校验成功才提交凭据。 */
it('登录触发弹窗，滑块释放通过后才真实登录', async () => {
  const wrapper = createPage()
  expect(wrapper.text()).not.toContain('请先填写手机号')
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(apiRequest).not.toHaveBeenCalled()
  expect(wrapper.get('.login-page__logo').attributes('src')).toContain('logo.png')
  await fill(wrapper)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  expect(vi.mocked(apiRequest).mock.calls.map(([path]) => path)).toEqual([
    '/auth/captcha/challenges'
  ])
  const captcha = wrapper.findComponent(SliderCaptcha)
  const track = captcha.get('.slider-captcha__track').element
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ width: 320 } as DOMRect)
  const slider = captcha.get('[role="slider"]')
  await slider.trigger('pointerdown', { pointerId: 1, clientX: 10, button: 0 })
  await slider.trigger('pointermove', { pointerId: 1, clientX: 150 })
  await flushPromises()
  expect(apiRequest).toHaveBeenCalledTimes(1)
  await slider.trigger('pointerup', { pointerId: 1, clientX: 150 })
  await flushPromises()
  expect(vi.mocked(apiRequest).mock.calls.map(([path]) => path)).toEqual([
    '/auth/captcha/challenges',
    '/auth/captcha/verify',
    '/auth/login'
  ])
  expect(apiRequest).toHaveBeenLastCalledWith(
    '/auth/login',
    {
      method: 'POST',
      body: { phone: '13800000000', password: 'valid-long-password', ticket: 'single-use-ticket' }
    },
    false
  )
  expect(setAccessToken).toHaveBeenCalledWith('access')
  expect(wrapper.emitted('login')).toEqual([[{ id: 'teacher' }]])
  expect(wrapper.get('input[type="password"]').element.value).toBe('')
  wrapper.unmount()
})
/** 关掉验证码不登录，重试重新取挑战；错误凭据不复用已消费的验证票据。 */
it('取消后重新验证，登录失败保留输入并关闭弹窗', async () => {
  const wrapper = createPage()
  await fill(wrapper)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  await wrapper.get('.close').trigger('click')
  expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path === '/auth/login')).toBe(false)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(
    vi.mocked(apiRequest).mock.calls.filter(([path]) => path.endsWith('/challenges'))
  ).toHaveLength(2)
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('手机号或密码错误'))
  wrapper.findComponent(SliderCaptcha).vm.$emit('verified', 'ticket')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toBe('手机号或密码错误')
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(wrapper.get('input[type="password"]').element.value).toBe('valid-long-password')
  expect(setAccessToken).not.toHaveBeenCalled()
  wrapper.unmount()
})
it('无效输入不创建挑战，登录中重复票据不重复发送', async () => {
  const wrapper = createPage()
  await wrapper.get('form').trigger('submit')
  expect(apiRequest).not.toHaveBeenCalled()
  await fill(wrapper)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  let finish!: (value: unknown) => void
  vi.mocked(apiRequest).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const captcha = wrapper.findComponent(SliderCaptcha)
  captcha.vm.$emit('verified', 'ticket')
  captcha.vm.$emit('verified', 'ticket')
  expect(vi.mocked(apiRequest).mock.calls.filter(([path]) => path === '/auth/login')).toHaveLength(
    1
  )
  wrapper.unmount()
  finish({ accessToken: 'late', user: { id: 'teacher' } })
  await flushPromises()
  expect(setAccessToken).not.toHaveBeenCalled()
})
