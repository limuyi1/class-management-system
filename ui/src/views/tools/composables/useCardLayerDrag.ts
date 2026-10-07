import { onBeforeUnmount, ref } from 'vue'

import type { Ref } from 'vue'
import type { CardTemplateType } from '@/types/PrintTools'

/** 将指针位移换算为毫米；缩放只改变屏幕比例，不改变保存坐标。 */
export function useCardLayerDrag(
  template: Ref<CardTemplateType>,
  box: Ref<HTMLElement | undefined>,
  busy: Ref<boolean>
) {
  const dragging = ref(false)
  let drag: {
    id: string
    x: number
    y: number
    clientX: number
    clientY: number
    width: number
    height: number
    resize: boolean
  } | null = null
  function begin(event: PointerEvent, id: string, resize = false): void {
    const layer = template.value.layers.find((item) => item.id === id)
    if (!layer || layer.locked || busy.value) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag = {
      id,
      x: layer.x,
      y: layer.y,
      clientX: event.clientX,
      clientY: event.clientY,
      width: layer.width,
      height: layer.height,
      resize
    }
    dragging.value = true
  }
  function move(event: PointerEvent): void {
    if (!drag || !box.value) return
    const layer = template.value.layers.find((item) => item.id === drag?.id)
    if (!layer) return
    const rect = box.value.getBoundingClientRect()
    const dx = ((event.clientX - drag.clientX) * template.value.width) / rect.width
    const dy = ((event.clientY - drag.clientY) * template.value.height) / rect.height
    if (drag.resize) {
      layer.width = Math.max(5, Math.min(template.value.width - layer.x, drag.width + dx))
      layer.height = Math.max(5, Math.min(template.value.height - layer.y, drag.height + dy))
    } else {
      layer.x = Math.max(0, Math.min(template.value.width - layer.width, drag.x + dx))
      layer.y = Math.max(0, Math.min(template.value.height - layer.height, drag.y + dy))
    }
  }
  function end(): void {
    drag = null
    dragging.value = false
  }
  onBeforeUnmount(end)
  return { dragging, begin, move, end }
}
