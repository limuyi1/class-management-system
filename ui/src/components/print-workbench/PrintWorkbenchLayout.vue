<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import type { ElScrollbar } from 'element-plus'

/** 页头和导出常驻，设置与预览各自滚动；不依赖主页面放开 overflow。 */
const props = defineProps<{ embedded?: boolean; sidebarWidth?: string; sidebarMode?: boolean }>()
const sidebar = ref<InstanceType<typeof ElScrollbar>>()
/** 切换填写与高级编辑后从设置顶部开始，避免沿用上一面板的滚动位置。 */
watch(
  () => props.sidebarMode,
  async () => {
    await nextTick()
    sidebar.value?.setScrollTop(0)
  }
)
</script>
<template>
  <div
    class="print-workbench"
    :class="{ 'app-page-shell': !embedded }"
    :style="{ '--print-sidebar-width': sidebarWidth }"
  >
    <header v-if="$slots.header" class="print-workbench__header"><slot name="header" /></header>
    <div v-if="$slots.toolbar" class="print-workbench__toolbar"><slot name="toolbar" /></div>
    <main class="print-workbench__body" :class="{ 'print-workbench__body--wide': !$slots.sidebar }">
      <el-scrollbar
        v-if="$slots.sidebar"
        ref="sidebar"
        class="print-workbench__sidebar"
        tabindex="0"
        aria-label="制作设置"
        ><div class="print-workbench__settings"><slot name="sidebar" /></div
      ></el-scrollbar>
      <section class="print-workbench__preview"><slot /></section>
    </main>
    <footer v-if="$slots.actions" class="print-workbench__footer">
      <el-scrollbar max-height="120px"
        ><div class="print-workbench__actions"><slot name="actions" /></div
      ></el-scrollbar>
    </footer>
    <slot name="outside" />
  </div>
</template>
<style scoped lang="scss">
.print-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  gap: 12px;
  overflow: hidden;
}
.print-workbench__header {
  flex: none;
}
.print-workbench__toolbar {
  flex: none;
  min-width: 0;
}
.print-workbench__header :deep(.page-header) {
  margin-bottom: 0;
}
.print-workbench__body {
  display: grid;
  grid-template-columns: var(--print-sidebar-width, 300px) minmax(0, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.print-workbench__body--wide {
  grid-template-columns: minmax(0, 1fr);
}
.print-workbench__sidebar {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.print-workbench__settings {
  padding-right: 10px;
}
.print-workbench__sidebar :deep(.el-scrollbar__wrap) {
  overscroll-behavior: contain;
}
.print-workbench__sidebar :deep(.el-card) {
  margin-bottom: 12px;
}
.print-workbench__sidebar :deep(.el-card__body) {
  padding: 16px;
}
.print-workbench__sidebar :deep(.el-select) {
  width: 100%;
}
.print-workbench__sidebar :deep(.el-button + .el-button) {
  margin-left: 0;
}
.print-workbench__preview {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.print-workbench__footer {
  flex: none;
  min-height: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}
.print-workbench__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}
.print-workbench__actions :deep(.el-button) {
  margin-left: 0;
}
@media (max-width: 1180px) {
  .print-workbench__body:not(.print-workbench__body--wide) {
    grid-template-columns: var(--print-sidebar-width, 270px) minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
