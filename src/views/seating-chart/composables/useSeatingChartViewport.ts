import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'

import type { ComputedRef, Ref } from 'vue'

/** 座位表视口缩放组合式函数的入参 */
interface SeatingChartViewportOptionsType {
  /** 座位网格视口元素引用 */
  viewportRef: Ref<HTMLElement | null>
  /** 座位行数 */
  rows: ComputedRef<number>
  /** 座位列数 */
  columns: ComputedRef<number>
  /** 过道数量 */
  aisleCount: ComputedRef<number>
  /** 布局键，行列或方向变化时触发重新缩放 */
  layoutKey: ComputedRef<string>
}

/** 单个座位（课桌）宽度 */
const DESK_WIDTH = 96
/** 单个座位高度 */
const DESK_HEIGHT = 58
/** 座位间距 */
const DESK_GAP = 10
/** 过道额外占用的宽度 */
const AISLE_EXTRA_WIDTH = 42
/** 行表头宽度 */
const ROW_HEADER_WIDTH = 42
/** 行表头与座位网格的间距 */
const ROW_HEADER_GAP = 10
/** 列表头高度 */
const COLUMN_HEADER_HEIGHT = 42
/** 列表头与座位网格的间距 */
const COLUMN_HEADER_GAP = 12
/** 视口内边距，避免内容贴边 */
const VIEWPORT_PADDING = 40
/** 最小缩放比例，低于该值交由滚动条承载 */
const MIN_SCALE = 0.95

/**
 * 根据座位画布的可用空间自动缩放；达到可读性下限后改由滚动条承载大布局。
 * @param options - 视口元素引用、行列数、过道数与布局键等响应式输入
 * @returns 缩放比例、舞台/内容样式与手动刷新函数
 */
export function useSeatingChartViewport(options: SeatingChartViewportOptionsType) {
  /** 当前缩放比例 */
  const scale = shallowRef(1)
  /** 视口尺寸观察器 */
  const resizeObserver = shallowRef<ResizeObserver | null>(null)

  const naturalWidth = computed(() => {
    if (options.columns.value === 0) return 0
    // 网格宽 = 行表头 + 间距 + 座位列宽 + 列间距 + 过道额外宽度
    const gridWidth =
      ROW_HEADER_WIDTH +
      ROW_HEADER_GAP +
      (options.columns.value * DESK_WIDTH +
        Math.max(0, options.columns.value - 1) * DESK_GAP +
        options.aisleCount.value * AISLE_EXTRA_WIDTH)
    return gridWidth
  })

  const naturalHeight = computed(() => {
    if (options.rows.value === 0) return 0
    // 网格高 = 座位行高 + 行间距 + 列表头 + 间距
    return (
      options.rows.value * DESK_HEIGHT +
      Math.max(0, options.rows.value - 1) * DESK_GAP +
      COLUMN_HEADER_HEIGHT +
      COLUMN_HEADER_GAP
    )
  })

  /** 缩放后的舞台尺寸样式 */
  const stageStyle = computed(() => ({
    width: `${Math.ceil(naturalWidth.value * scale.value)}px`,
    height: `${Math.ceil(naturalHeight.value * scale.value)}px`
  }))

  /** 座位内容样式：原始尺寸 + 缩放变换 */
  const contentStyle = computed(() => ({
    width: `${naturalWidth.value}px`,
    height: `${naturalHeight.value}px`,
    transform: `scale(${scale.value})`
  }))

  /** 依据视口可用空间重新计算缩放比例 */
  function updateScale(): void {
    const viewport = options.viewportRef.value
    if (!viewport || naturalWidth.value === 0 || naturalHeight.value === 0) {
      scale.value = 1
      return
    }

    // 按视口可用空间计算适配比例，但不低于可读性下限
    const availableWidth = Math.max(1, viewport.clientWidth - VIEWPORT_PADDING)
    const availableHeight = Math.max(1, viewport.clientHeight - VIEWPORT_PADDING)
    const fitScale = Math.min(
      1,
      availableWidth / naturalWidth.value,
      availableHeight / naturalHeight.value
    )
    scale.value = Math.max(MIN_SCALE, fitScale)
  }

  /** 等待 DOM 更新后重新计算缩放 */
  async function refresh(): Promise<void> {
    await nextTick()
    updateScale()
  }

  // 行列数、过道数或布局方向变化时重新计算缩放
  watch([options.rows, options.columns, options.aisleCount, options.layoutKey], refresh, {
    immediate: true
  })

  // 视口元素挂载后监听尺寸变化
  watch(
    options.viewportRef,
    (viewport) => {
      resizeObserver.value?.disconnect()
      resizeObserver.value = null
      if (viewport) {
        resizeObserver.value = new ResizeObserver(updateScale)
        resizeObserver.value.observe(viewport)
      }
      void refresh()
    },
    { immediate: true, flush: 'post' }
  )

  // 卸载时断开尺寸观察器
  onBeforeUnmount(() => {
    resizeObserver.value?.disconnect()
  })

  return {
    scale,
    stageStyle,
    contentStyle,
    refresh
  }
}
