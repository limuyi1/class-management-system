<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import type { ElScrollbar } from 'element-plus'

import { usePrintPreviewScale } from '@/hooks/usePrintPreviewScale'
import { PrintPreviewModeEnum } from '@/types/PrintPreview'

const props = withDefaults(defineProps<{ width?: number; fitWidth?: boolean }>(), {
  width: 1120,
  fitWidth: false
})
const scrollbar = ref<InstanceType<typeof ElScrollbar>>()
const viewport = computed(() => scrollbar.value?.wrapRef)
const content = ref<HTMLElement>()
const { mode, scale, height, zoom, percent } = usePrintPreviewScale(
  viewport,
  content,
  toRef(props, 'width')
)
if (props.fitWidth) mode.value = PrintPreviewModeEnum.FitWidth
</script>
<template>
  <section class="print-preview" aria-label="打印预览">
    <div class="print-preview__toolbar">
      <div class="print-preview__navigation"><slot name="navigation" /></div>
      <div class="print-preview__zoom">
        <el-select v-model="mode" aria-label="预览缩放" style="width: 112px" size="small">
          <el-option label="整页适应" :value="PrintPreviewModeEnum.FitPage" />
          <el-option label="适应宽度" :value="PrintPreviewModeEnum.FitWidth" />
          <el-option label="100%" :value="PrintPreviewModeEnum.Actual" />
          <el-option label="200%" :value="PrintPreviewModeEnum.Double" />
          <el-option label="400%" :value="PrintPreviewModeEnum.Quadruple" />
          <el-option
            v-if="mode === PrintPreviewModeEnum.Custom"
            label="手动缩放"
            :value="PrintPreviewModeEnum.Custom"
          />
        </el-select>
        <el-button size="small" aria-label="缩小预览" @click="zoom(-0.1)">−</el-button>
        <span>{{ percent }}%</span>
        <el-button size="small" aria-label="放大预览" @click="zoom(0.1)">＋</el-button>
      </div>
    </div>
    <el-scrollbar
      ref="scrollbar"
      class="print-preview__viewport"
      tabindex="0"
      aria-label="可滚动的预览区域"
      ><div class="print-preview__padding">
        <div
          class="print-preview__sheet"
          :style="{ width: `${width * scale}px`, height: `${height * scale}px` }"
        >
          <div
            ref="content"
            class="print-preview__content"
            :style="{ width: `${width}px`, transform: `scale(${scale})` }"
          >
            <slot />
          </div>
        </div></div
    ></el-scrollbar>
  </section>
</template>
<style scoped lang="scss">
.print-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}
.print-preview__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 10px 12px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}
.print-preview__navigation,
.print-preview__zoom {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.print-preview__zoom {
  margin-left: auto;
  font-size: 12px;
}
.print-preview__zoom :deep(.el-button) {
  margin: 0;
}
.print-preview__viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.print-preview__padding {
  padding: 16px;
  min-width: 100%;
  width: max-content;
}
.print-preview__viewport :deep(.el-scrollbar__wrap) {
  overscroll-behavior: contain;
}
.print-preview__sheet {
  position: relative;
  margin: 0 auto;
}
.print-preview__content {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}
</style>
