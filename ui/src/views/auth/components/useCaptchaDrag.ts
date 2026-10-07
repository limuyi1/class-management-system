import { computed, ref } from 'vue'
import type { Ref } from 'vue'

/** 鼠标、触摸和触控笔共用 Pointer Events，以原图坐标换算距离，缩放后仍与拼图对齐。 */
export function useCaptchaDrag(
  width: Ref<number>,
  pieceSize: Ref<number>,
  disabled: Ref<boolean>,
  onRelease: () => void
) {
  const position = ref(0)
  const track = ref<HTMLElement>()
  const dragging = ref(false)
  const maximum = computed(() => width.value - pieceSize.value)
  let active: { id: number; x: number; position: number; displayWidth: number } | undefined

  /** 保留按下时的抓取点，避免触摸手柄边缘时拼图突然跳动。 */
  function start(event: PointerEvent): void {
    if (disabled.value || active || event.button !== 0) return
    const displayWidth = track.value?.getBoundingClientRect().width || 0
    if (!displayWidth) return
    active = { id: event.pointerId, x: event.clientX, position: position.value, displayWidth }
    dragging.value = true
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }
  function move(event: PointerEvent): void {
    if (!active || active.id !== event.pointerId || disabled.value) return
    position.value = Math.round(
      Math.min(
        maximum.value,
        Math.max(
          0,
          active.position + ((event.clientX - active.x) * width.value) / active.displayWidth
        )
      )
    )
  }
  /** 仅正常释放才发起验证；系统取消触摸、刷新和账号变化不会误提交。 */
  function finish(event: PointerEvent): void {
    if (!active || active.id !== event.pointerId) return
    move(event)
    active = undefined
    dragging.value = false
    if (!disabled.value) onRelease()
  }
  function cancel(): void {
    active = undefined
    dragging.value = false
    position.value = 0
  }
  function keydown(event: KeyboardEvent): void {
    if (disabled.value || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? maximum.value
          : position.value + (event.key === 'ArrowRight' ? 4 : -4)
    position.value = Math.min(maximum.value, Math.max(0, next))
  }
  function keyup(event: KeyboardEvent): void {
    if (!disabled.value && ['Enter', ' '].includes(event.key)) {
      event.preventDefault()
      onRelease()
    }
  }
  return { position, track, dragging, maximum, start, move, finish, cancel, keydown, keyup }
}
