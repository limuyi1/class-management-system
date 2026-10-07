<script setup lang="ts">
import { ref, computed } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { OverlengthTextTooltipProps } from '@/types/OverlengthTextTooltip'

/**
 * 超长文本提示组件。
 *
 * 当文本因宽度限制或行数截断无法完整展示时，自动启用 tooltip 悬浮提示；
 * 通过 Range 测量文字实际尺寸与容器内边距判断是否发生溢出。
 */
const props = withDefaults(defineProps<OverlengthTextTooltipProps>(), {
  level: 1
})

/** 文本容器 DOM 引用 */
const text = ref<HTMLElement>()
/** 文本是否发生截断溢出 */
const isEllipsis = ref(false)

/**
 * 监听元素大小变化
 */
useResizeObserver(text, () => {
  checkEllipsis()
})

/**
 * 检测是否超出
 */
const checkEllipsis = () => {
  const _text = text.value as HTMLElement

  if (!_text) {
    return
  }

  const range = document.createRange()
  range.setStart(_text, 0)
  range.setEnd(_text, _text.childNodes.length)
  window.getSelection()!.addRange(range)
  const rangeWidth = range.getBoundingClientRect().width // 所有文字的宽度
  const rangeHeight = range.getBoundingClientRect().height // 所有文字的高度

  const { pLeft, pRight, pTop, pBottom } = getPadding(_text)
  const horizontalPadding = pLeft + pRight
  const verticalPadding = pTop + pBottom

  isEllipsis.value =
    rangeWidth + horizontalPadding > _text.offsetWidth ||
    rangeHeight + verticalPadding > _text.offsetHeight
}

/**
 * 获取元素的内边距
 * @param el - 目标元素
 * @returns 上下左右四向内边距
 */
const getPadding = (el: HTMLElement) => {
  const style = window.getComputedStyle(el, null)
  const paddingLeft = Number.parseInt(style.paddingLeft, 10) || 0
  const paddingRight = Number.parseInt(style.paddingRight, 10) || 0
  const paddingTop = Number.parseInt(style.paddingTop, 10) || 0
  const paddingBottom = Number.parseInt(style.paddingBottom, 10) || 0
  return {
    pLeft: paddingLeft,
    pRight: paddingRight,
    pTop: paddingTop,
    pBottom: paddingBottom
  }
}

/** 文本容器样式：宽度、行数截断与自定义样式合并 */
const getStyle = computed(() => {
  return Object.assign(
    {},
    { width: `${props.width}px`, '-webkit-line-clamp': props.level },
    props.customStyle
  )
})
</script>

<template>
  <!-- 文本溢出时启用 tooltip 展示完整内容 -->
  <el-tooltip
    :content="String(content)"
    placement="top"
    :disabled="!isEllipsis"
    popper-class="overlength-text-tooltip__popper"
  >
    <div ref="text" :class="['overlength-text-tooltip', customClass]" :style="getStyle">
      {{ content }}
    </div>
  </el-tooltip>
</template>

<style scoped lang="scss">
.overlength-text-tooltip {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

:global(.overlength-text-tooltip__popper) {
  max-width: 320px;
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
}
</style>
