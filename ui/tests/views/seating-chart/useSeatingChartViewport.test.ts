import { computed, defineComponent, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSeatingChartViewport } from '@/views/seating-chart/composables/useSeatingChartViewport'

/**
 * useSeatingChartViewport 组合式函数测试
 * 测试目标：座位表视口自动缩放
 * 覆盖功能：自然尺寸公式、fitScale 计算与 0.95 可读性下限钳制、
 * 空视口/零行列回退、视口变化后的手动刷新、ResizeObserver 创建与清理
 */

// ResizeObserver 替身：happy-dom 未实现该 API，实例记录到数组供断言
const observerInstances: ResizeObserverMock[] = []
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor() {
    observerInstances.push(this)
  }
}

/** 挂载宿主组件并暴露组合式函数的返回值 */
const mountViewport = (options: Parameters<typeof useSeatingChartViewport>[0]) => {
  let exposed: ReturnType<typeof useSeatingChartViewport> | undefined
  const Component = defineComponent({
    setup() {
      exposed = useSeatingChartViewport(options)
    },
    template: '<div />'
  })
  const wrapper = mount(Component)
  return {
    wrapper,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    getState: () => exposed!
  }
}

describe('useSeatingChartViewport', () => {
  let viewportRef: ReturnType<typeof shallowRef<HTMLElement | null>>

  beforeEach(() => {
    observerInstances.length = 0
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    viewportRef = shallowRef<HTMLElement | null>(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** 构造常用选项：8 列 6 行 1 条过道 */
  const createOptions = () => ({
    viewportRef,
    rows: computed(() => 6),
    columns: computed(() => 8),
    aisleCount: computed(() => 1),
    layoutKey: computed(() => '8x6-landscape')
  })

  it('computes the natural grid size from rows, columns and aisles', async () => {
    const { getState } = mountViewport(createOptions())
    await nextTick()

    // 自然宽 = 行表头42 + 间距10 + 列宽8*96 + 列间距7*10 + 过道1*42
    expect(getState().stageStyle.value.width).toBe(`${Math.ceil(932 * getState().scale.value)}px`)
    // 自然高 = 行高6*58 + 行间距5*10 + 列表头42 + 间距12
    expect(getState().contentStyle.value.height).toBe('452px')
  })

  it('excludes the column header height when it uses an independent rail', async () => {
    const { getState } = mountViewport({
      ...createOptions(),
      hasInlineColumnHeader: false
    })
    await nextTick()

    expect(getState().contentStyle.value.height).toBe('398px')
  })

  it('clamps the scale to the readable minimum of 0.95 for small viewports', async () => {
    viewportRef.value = { clientWidth: 800, clientHeight: 600 } as HTMLElement
    const { getState } = mountViewport(createOptions())
    await nextTick()

    // 800x600 视口下适配比例约 0.815，被钳制到 0.95 下限
    expect(getState().scale.value).toBeCloseTo(0.95, 3)
  })

  it('computes an intermediate scale between 0.95 and 1 when it fits', async () => {
    viewportRef.value = { clientWidth: 940, clientHeight: 600 } as HTMLElement
    const { getState } = mountViewport(createOptions())
    await nextTick()

    // 可用宽 900 / 自然宽 932，落在 (0.95, 1) 区间内
    expect(getState().scale.value).toBeCloseTo(900 / 932, 3)
  })

  it('caps the scale at 1 for a large enough viewport', async () => {
    viewportRef.value = { clientWidth: 2000, clientHeight: 1500 } as HTMLElement
    const { getState } = mountViewport(createOptions())
    await nextTick()

    expect(getState().scale.value).toBe(1)
  })

  it('falls back to scale 1 without a viewport element', async () => {
    const { getState } = mountViewport(createOptions())
    await nextTick()

    expect(getState().scale.value).toBe(1)
  })

  it('falls back to scale 1 when rows or columns are zero', async () => {
    viewportRef.value = { clientWidth: 800, clientHeight: 600 } as HTMLElement
    const options = createOptions()
    const columns = shallowRef(0)
    const { getState } = mountViewport({
      ...options,
      columns: computed(() => columns.value)
    })
    await getState().refresh()
    expect(getState().scale.value).toBe(1)

    columns.value = 8
    await getState().refresh()
    expect(getState().scale.value).toBeCloseTo(0.95, 3)
  })

  it('recalculates the scale on manual refresh after viewport resize', async () => {
    const viewport = { clientWidth: 940, clientHeight: 600 } as HTMLElement
    viewportRef.value = viewport
    const { getState } = mountViewport(createOptions())
    await nextTick()
    expect(getState().scale.value).toBeCloseTo(900 / 932, 3)

    viewport.clientWidth = 2000
    await getState().refresh()

    expect(getState().scale.value).toBe(1)
  })

  it('creates an observer for the viewport and disconnects it on unmount', async () => {
    viewportRef.value = { clientWidth: 800, clientHeight: 600 } as HTMLElement
    const { wrapper, getState } = mountViewport(createOptions())
    await nextTick()
    expect(getState().scale.value).toBeCloseTo(0.95, 3)

    expect(observerInstances).toHaveLength(1)
    expect(observerInstances[0].observe).toHaveBeenCalledWith(viewportRef.value)

    wrapper.unmount()
    expect(observerInstances[0].disconnect).toHaveBeenCalled()
  })
})
