<script setup lang="ts">
/** 编辑节点与选择控件分层：正文可选中，拖动使用选中图层的标签和手柄。 */
import { computed, ref, toRef } from 'vue'

import CardPaper from './CardPaper.vue'
import { useCardLayerDrag } from '../../composables/useCardLayerDrag'

import type { CardTemplateType } from '@/types/PrintTools'

const props = defineProps<{
  template: CardTemplateType
  fields: Record<string, string>
  busy: boolean
  /** 常规制作只阅读 DOM；进入高级设置后才选择和拖动图层。 */
  editing?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
const selectedLayerId = defineModel<string>({ required: true })
const selectedLayer = computed(() =>
  props.template.layers.find((layer) => layer.id === selectedLayerId.value && !layer.hidden)
)
const warnings = ref<string[]>([])
const renderError = ref('')
const canvasBox = ref<HTMLElement>()
const { dragging, begin, move, end } = useCardLayerDrag(
  toRef(props, 'template'),
  canvasBox,
  toRef(props, 'busy')
)
/** 点击文字或素材选层，不阻止浏览器的文本选择。 */
function select(event: MouseEvent): void {
  if (!props.editing || props.busy || dragging.value) return
  const node = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-print-node], [data-print-extra]'
  )
  const layer = props.template.layers.find(
    (item) =>
      node &&
      (item.scene
        ? item.scene.nodeId === node.dataset.printNode
        : item.id === node.dataset.printExtra)
  )
  selectedLayerId.value = layer?.id || ''
  if (layer) emit('select')
}
</script>
<template>
  <div>
    <div
      ref="canvasBox"
      class="card-canvas"
      :style="{ width: `${template.width * 6}px`, height: `${template.height * 6}px` }"
      @click="select"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
    >
      <CardPaper
        :template="template"
        :fields="fields"
        @warnings="warnings = $event"
        @error="renderError = $event"
      />
      <div
        v-if="editing && selectedLayer"
        class="card-canvas__selection"
        :style="{
          left: `${selectedLayer.x * 6}px`,
          top: `${selectedLayer.y * 6}px`,
          width: `${selectedLayer.width * 6}px`,
          height: `${selectedLayer.height * 6}px`
        }"
      >
        <button
          class="card-canvas__label"
          :disabled="busy || selectedLayer.locked"
          aria-label="移动选中图层"
          @click.stop
          @pointerdown.stop="begin($event, selectedLayer.id)"
        >
          {{ selectedLayer.label }} · 拖动
        </button>
        <button
          v-if="!selectedLayer.locked"
          class="card-canvas__resize"
          :disabled="busy"
          aria-label="缩放图层"
          @click.stop
          @pointerdown.stop="begin($event, selectedLayer.id, true)"
        />
      </div>
    </div>
    <el-alert
      v-if="renderError || warnings.length"
      type="warning"
      :closable="false"
      :title="renderError || warnings.join('；')"
    />
  </div>
</template>
<style scoped lang="scss">
.card-canvas {
  position: relative;
  background: white;
  box-shadow: 0 4px 16px #0002;
}
.card-canvas__selection {
  position: absolute;
  border: 2px dashed var(--el-color-primary);
  pointer-events: none;
  box-sizing: border-box;
}
.card-canvas__label {
  position: absolute;
  bottom: 100%;
  left: 0;
  max-width: 380px;
  overflow: hidden;
  white-space: nowrap;
  font-size: 22px;
  background: var(--el-color-primary);
  color: white;
  padding: 4px 10px;
  border: 0;
  pointer-events: auto;
  cursor: move;
  touch-action: none;
}
.card-canvas__resize {
  position: absolute;
  bottom: -10px;
  right: -10px;
  width: 20px;
  height: 20px;
  border: none;
  background: var(--el-color-primary);
  cursor: nwse-resize;
  pointer-events: auto;
  touch-action: none;
}
.el-alert {
  margin-top: 12px;
}
</style>
