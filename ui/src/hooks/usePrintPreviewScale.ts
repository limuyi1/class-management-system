import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { PrintPreviewModeEnum } from '@/types/PrintPreview'

import type { Ref } from 'vue'

/** 同时观察视口与正文；缩放占位使用原始尺寸，避免长内容末尾无法滚动到达。 */
export function usePrintPreviewScale(
  viewport: Ref<HTMLElement | undefined>,
  content: Ref<HTMLElement | undefined>,
  width: Ref<number>
) {
  const mode = ref(PrintPreviewModeEnum.FitPage)
  const scale = ref(1)
  const height = ref(1)
  let observer: ResizeObserver | undefined
  function measure(): void {
    if (!viewport.value || !content.value) return
    height.value = Math.max(content.value.offsetHeight, 1)
    const availableWidth = Math.max(viewport.value.clientWidth - 32, 1)
    const availableHeight = Math.max(viewport.value.clientHeight - 32, 1)
    if (mode.value === PrintPreviewModeEnum.Actual) scale.value = 1
    else if (mode.value === PrintPreviewModeEnum.Double) scale.value = 2
    else if (mode.value === PrintPreviewModeEnum.Quadruple) scale.value = 4
    else if (mode.value !== PrintPreviewModeEnum.Custom) {
      scale.value = Math.min(
        2,
        availableWidth / width.value,
        mode.value === PrintPreviewModeEnum.FitPage ? availableHeight / height.value : 2
      )
    }
  }
  /** 手动缩放保留当前位置，随后按新的占位尺寸产生真实滚动范围。 */
  function zoom(delta: number): void {
    mode.value = PrintPreviewModeEnum.Custom
    scale.value = Math.min(4, Math.max(0.1, scale.value + delta))
  }
  watch([mode, width], measure)
  onMounted(() => {
    observer = new ResizeObserver(measure)
    if (viewport.value) observer.observe(viewport.value)
    if (content.value) observer.observe(content.value)
    measure()
  })
  onBeforeUnmount(() => observer?.disconnect())
  return { mode, scale, height, zoom, percent: computed(() => Math.round(scale.value * 100)) }
}
