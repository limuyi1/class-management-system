import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppEChart from '../../src/components/AppEChart.vue'

const chart = vi.hoisted(() => ({
  init: vi.fn(),
  use: vi.fn(),
  setOption: vi.fn(),
  dispose: vi.fn(),
  resize: vi.fn(),
  finished: undefined as (() => void) | undefined
}))
vi.mock('echarts/core', () => ({
  init: chart.init,
  use: chart.use
}))

/** 挂载真实封装，替换底层绘图库，防止 Vue 导入落在 SFC 脚本之外而漏检。 */
describe('AppEChart 真实挂载', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chart.finished = undefined
    chart.init.mockImplementation(() => ({
      setOption: chart.setOption,
      dispose: chart.dispose,
      resize: chart.resize,
      on: (_name: string, callback: () => void) => {
        chart.finished = callback
      }
    }))
  })
  it('默认画布可以完成 setup、初始化和卸载', async () => {
    const option = { series: [{ type: 'bar' as const, data: [0, 80] }] }
    const wrapper = mount(AppEChart, { props: { option } })
    await flushPromises()
    expect(chart.init).toHaveBeenCalledWith(wrapper.get('.app-echart').element, undefined, {
      renderer: 'canvas'
    })
    expect(chart.setOption).toHaveBeenCalledWith(option, true)
    wrapper.unmount()
    expect(chart.dispose).toHaveBeenCalledOnce()
  })
  it('学习报告使用 SVG；更新后等待绘制完成，切换渲染器释放旧实例', async () => {
    const wrapper = mount(AppEChart, { props: { option: {}, renderer: 'svg' } })
    await flushPromises()
    expect(chart.init).toHaveBeenCalledWith(wrapper.get('.app-echart').element, undefined, {
      renderer: 'svg'
    })
    expect(wrapper.get('.app-echart').attributes('data-print-chart-ready')).toBe('false')
    const finished = vi.fn()
    wrapper.get('.app-echart').element.addEventListener('print-chart-ready', finished)
    chart.finished?.()
    expect(wrapper.get('.app-echart').attributes('data-print-chart-ready')).toBe('true')
    expect(finished).toHaveBeenCalledOnce()
    await wrapper.setProps({ option: { animation: false } })
    expect(wrapper.get('.app-echart').attributes('data-print-chart-ready')).toBe('false')
    await wrapper.setProps({ renderer: 'canvas' })
    await flushPromises()
    expect(chart.dispose).toHaveBeenCalledOnce()
    expect(chart.init).toHaveBeenLastCalledWith(wrapper.get('.app-echart').element, undefined, {
      renderer: 'canvas'
    })
    wrapper.unmount()
  })
})
