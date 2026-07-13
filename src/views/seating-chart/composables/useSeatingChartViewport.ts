import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'

import type { ComputedRef, Ref } from 'vue'

interface SeatingChartViewportOptionsType {
  viewportRef: Ref<HTMLElement | null>
  rows: ComputedRef<number>
  columns: ComputedRef<number>
  aisleCount: ComputedRef<number>
  layoutKey: ComputedRef<string>
}

const DESK_WIDTH = 96
const DESK_HEIGHT = 58
const DESK_GAP = 10
const AISLE_EXTRA_WIDTH = 42
const ROW_HEADER_WIDTH = 42
const ROW_HEADER_GAP = 10
const COLUMN_HEADER_HEIGHT = 42
const COLUMN_HEADER_GAP = 12
const VIEWPORT_PADDING = 40
const MIN_SCALE = 0.95

/**
 * 根据座位画布的可用空间自动缩放；达到可读性下限后改由滚动条承载大布局。
 */
export function useSeatingChartViewport(options: SeatingChartViewportOptionsType) {
  const scale = shallowRef(1)
  const resizeObserver = shallowRef<ResizeObserver | null>(null)

  const naturalWidth = computed(() => {
    if (options.columns.value === 0) return 0
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
    return (
      options.rows.value * DESK_HEIGHT +
      Math.max(0, options.rows.value - 1) * DESK_GAP +
      COLUMN_HEADER_HEIGHT +
      COLUMN_HEADER_GAP
    )
  })

  const stageStyle = computed(() => ({
    width: `${Math.ceil(naturalWidth.value * scale.value)}px`,
    height: `${Math.ceil(naturalHeight.value * scale.value)}px`
  }))

  const contentStyle = computed(() => ({
    width: `${naturalWidth.value}px`,
    height: `${naturalHeight.value}px`,
    transform: `scale(${scale.value})`
  }))

  function updateScale(): void {
    const viewport = options.viewportRef.value
    if (!viewport || naturalWidth.value === 0 || naturalHeight.value === 0) {
      scale.value = 1
      return
    }

    const availableWidth = Math.max(1, viewport.clientWidth - VIEWPORT_PADDING)
    const availableHeight = Math.max(1, viewport.clientHeight - VIEWPORT_PADDING)
    const fitScale = Math.min(
      1,
      availableWidth / naturalWidth.value,
      availableHeight / naturalHeight.value
    )
    scale.value = Math.max(MIN_SCALE, fitScale)
  }

  async function refresh(): Promise<void> {
    await nextTick()
    updateScale()
  }

  watch([options.rows, options.columns, options.aisleCount, options.layoutKey], refresh, {
    immediate: true
  })

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
