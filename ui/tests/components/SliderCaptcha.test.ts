import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SliderCaptcha from '@/views/auth/components/SliderCaptcha.vue'
import { apiRequest } from '@/api/client'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))

const stubs = {
  ElButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  ElSlider: true
}

afterEach(() => vi.clearAllMocks())

describe('滑块挑战归属', () => {
  it('手机号变化后晚到的旧响应不得重新激活旧挑战', async () => {
    let complete!: (value: unknown) => void
    vi.mocked(apiRequest).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const wrapper = mount(SliderCaptcha, { props: { phone: '13800000000' }, global: { stubs } })
    await wrapper.find('button').trigger('click')
    await wrapper.setProps({ phone: '13900000000' })
    complete({ challengeId: 'old-challenge', image: 'data:image/svg+xml;base64,old' })
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.emitted('verified')?.at(-1)).toEqual([''])
    wrapper.unmount()
  })
})

/** 缩小到 240px 的图片仍使用 320px 原图坐标；触摸释放只验证一次。 */
it('触屏拖动等比例换算，拼图与手柄对齐，松手才提交', async () => {
  vi.mocked(apiRequest)
    .mockResolvedValueOnce({
      challengeId: 'touch',
      image: 'data:image/svg+xml;base64,test',
      width: 320,
      height: 160,
      pieceSize: 48,
      pieceY: 56,
      piecePath: 'M24 2L46 46L2 46Z'
    })
    .mockResolvedValueOnce({ ticket: 'ticket' })
  const wrapper = mount(SliderCaptcha, {
    props: { phone: '13800000000', autoLoad: true },
    global: { stubs }
  })
  await flushPromises()
  vi.spyOn(wrapper.get('.slider-captcha__track').element, 'getBoundingClientRect').mockReturnValue({
    width: 240
  } as DOMRect)
  const handle = wrapper.get('[role="slider"]')
  await handle.trigger('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    button: 0,
    clientX: 12
  })
  await handle.trigger('pointermove', { pointerId: 8, clientX: 150 })
  expect(handle.attributes('aria-valuenow')).toBe('0')
  await handle.trigger('pointermove', { pointerId: 7, clientX: 117 })
  expect(handle.attributes('aria-valuenow')).toBe('140')
  expect(wrapper.get('.slider-captcha__piece').attributes('style')).toContain('left: 43.75%')
  expect(handle.attributes('style')).toContain('left: 43.75%')
  expect(apiRequest).toHaveBeenCalledTimes(1)
  await handle.trigger('pointerup', { pointerId: 7, clientX: 117 })
  await handle.trigger('lostpointercapture')
  await flushPromises()
  expect(apiRequest).toHaveBeenLastCalledWith('/auth/captcha/verify', {
    method: 'POST',
    body: { challengeId: 'touch', position: 140 }
  })
  expect(handle.attributes('aria-valuenow')).toBe('140')
  expect(wrapper.emitted('verified')?.at(-1)).toEqual(['ticket'])
  wrapper.unmount()
})
it('触摸取消不验证，拖动超出边界被限制在轨道内', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    challengeId: 'cancel',
    image: 'data:image/svg+xml;base64,test',
    width: 320,
    height: 160,
    pieceSize: 48,
    pieceY: 56,
    piecePath: 'M0 0H48V48H0Z'
  })
  const wrapper = mount(SliderCaptcha, {
    props: { phone: '13800000000', autoLoad: true },
    global: { stubs }
  })
  await flushPromises()
  vi.spyOn(wrapper.get('.slider-captcha__track').element, 'getBoundingClientRect').mockReturnValue({
    width: 320
  } as DOMRect)
  const handle = wrapper.get('[role="slider"]')
  await handle.trigger('pointerdown', { pointerId: 1, clientX: 20, button: 0 })
  await handle.trigger('pointermove', { pointerId: 1, clientX: 999 })
  expect(handle.attributes('aria-valuenow')).toBe('272')
  await handle.trigger('pointermove', { pointerId: 1, clientX: -999 })
  expect(handle.attributes('aria-valuenow')).toBe('0')
  await handle.trigger('pointercancel', { pointerId: 1 })
  await handle.trigger('pointerup', { pointerId: 1, clientX: 150 })
  expect(apiRequest).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
