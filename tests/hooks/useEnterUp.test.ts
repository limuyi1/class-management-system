import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useEnterUp } from '../../src/hooks/useEnterUp'

/**
 * useEnterUp 组合式函数测试
 * 测试目标：全局回车键监听
 * 覆盖功能：name 匹配触发、其他按键/输入框忽略、输入法组合过滤、节流、防抖、卸载移除监听
 */

/** 挂载一个调用 useEnterUp 的最小宿主组件，以获得卸载生命周期 */
const mountEnterUp = (nameProperty: string, fn: () => void | Promise<void>, throttleMs = 0) => {
  const component = defineComponent({
    setup() {
      useEnterUp(nameProperty, fn, throttleMs)
    },
    template: '<div />'
  })
  return mount(component)
}

/** 在 document 上派发一次回车事件，并伪造事件目标 */
const dispatchEnter = (
  targetName: string | null,
  overrides: Record<string, unknown> = {}
): void => {
  const event = new KeyboardEvent('keyup', { key: 'Enter' })
  Object.defineProperty(event, 'target', { value: { name: targetName } })
  Object.entries(overrides).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value })
  })
  document.dispatchEvent(event)
}

describe('useEnterUp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers the callback when Enter is pressed on the matching input', () => {
    const fn = vi.fn()
    mountEnterUp('search', fn)

    dispatchEnter('search')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys and other input names', () => {
    const fn = vi.fn()
    mountEnterUp('search', fn)

    const otherKey = new KeyboardEvent('keyup', { key: 'a' })
    Object.defineProperty(otherKey, 'target', { value: { name: 'search' } })
    document.dispatchEvent(otherKey)
    dispatchEnter('other')

    expect(fn).not.toHaveBeenCalled()
  })

  it('ignores Enter during IME composition', () => {
    const fn = vi.fn()
    mountEnterUp('search', fn)

    dispatchEnter('search', { isComposing: true })

    expect(fn).not.toHaveBeenCalled()
  })

  it('throttles repeated Enter presses within the throttle window', () => {
    const fn = vi.fn()
    mountEnterUp('search', fn, 100)

    dispatchEnter('search')
    vi.setSystemTime(new Date('2026-09-07T08:00:00.050Z'))
    dispatchEnter('search')
    vi.setSystemTime(new Date('2026-09-07T08:00:00.100Z'))
    dispatchEnter('search')

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('debounces Enter presses while a previous async callback is running', async () => {
    let resolveCallback: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      resolveCallback = resolve
    })
    const fn = vi.fn(() => pending)
    mountEnterUp('search', fn)

    dispatchEnter('search')
    dispatchEnter('search')

    expect(fn).toHaveBeenCalledTimes(1)

    resolveCallback?.()
    await Promise.resolve()
    dispatchEnter('search')

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('logs errors from the callback without breaking the listener', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fn = vi.fn(() => {
      throw new Error('回调失败')
    })
    mountEnterUp('search', fn)

    dispatchEnter('search')
    dispatchEnter('search')

    expect(consoleSpy).toHaveBeenCalledWith('useEnterUp 执行出错:', expect.any(Error))
    expect(fn).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('removes the listener when the host component unmounts', () => {
    const fn = vi.fn()
    const wrapper = mountEnterUp('search', fn)

    dispatchEnter('search')
    expect(fn).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    dispatchEnter('search')

    expect(fn).toHaveBeenCalledTimes(1)
  })
})
