<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useApiPaper } from '@/hooks/api/useApiPaper'
import { mmToPixelPrecise } from '@/utils/pageSizeInPixelUtil'
import { PagesEnum } from '@/types/Common'
import type { ResourceType } from '@/types/ApiResources'
const props = defineProps<{ ownerId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
const state = useApiPaper(() => props.ownerId)
const { settings, previewPanelRef, drafts, attachments, selected, name, busy, hasDraft } = state
const { pages, pageStyle, canvasItems, selectedItem } = state.canvas
async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    console.error('试卷排版操作失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}
async function open(draft: ResourceType): Promise<void> {
  if (hasDraft.value) {
    try {
      await ElMessageBox.confirm('放弃未保存排版并打开草稿？', '打开草稿', { type: 'warning' })
    } catch {
      return
    }
  }
  await run(() => state.open(draft))
}
async function remove(draft: ResourceType): Promise<void> {
  try {
    await ElMessageBox.confirm(`软删除排版“${draft.name}”？`, '删除草稿', { type: 'warning' })
  } catch {
    return
  }
  await run(() => state.remove(draft))
}
watch(busy, (value) => emit('busy', value))
watch(
  () => props.ownerId,
  () => {
    state.reset()
    state.attachmentPage.value = 1
    state.drafts.value = []
    state.attachments.value = []
    void run(state.load)
  },
  { immediate: true }
)
onMounted(() => {
  window.addEventListener('pointermove', state.canvas.handlePointerMove)
  window.addEventListener('pointerup', state.canvas.handlePointerUp)
  state.canvas.previewScale.value = 1
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', state.canvas.handlePointerMove)
  window.removeEventListener('pointerup', state.canvas.handlePointerUp)
  emit('busy', false)
})
defineExpose({ hasDraft, reset: state.reset })
</script>
<template>
  <section>
    <el-form inline :disabled="busy"
      ><el-input v-model="name" maxlength="100" placeholder="草稿名称" /><el-select
        v-model="settings.pageType"
        ><el-option v-for="type in PagesEnum" :key="type" :label="type" :value="type"
      /></el-select>
      <el-select v-model="settings.orientation"
        ><el-option label="纵向" value="portrait" /><el-option label="横向" value="landscape"
      /></el-select>
      <el-select v-model="settings.layoutMode"
        ><el-option label="单栏" value="single" /><el-option
          label="双栏"
          value="double" /><el-option label="自由排版" value="free"
      /></el-select>
      <el-input-number v-model="settings.columns" :min="1" :max="10" /><el-input-number
        v-model="settings.margin"
        :min="0"
        :max="50"
      /><el-input-number v-model="settings.gap" :min="0" :max="50" />
      <el-select v-model="selected" multiple placeholder="选择素材"
        ><el-option v-for="file in attachments" :key="file.id" :value="file.id" :label="file.name"
      /></el-select>
      <el-button @click="run(state.add)">加入图片</el-button
      ><el-button @click="state.canvas.autoArrange">自动排版</el-button
      ><el-button @click="state.canvas.removeSelectedItem">移除选中</el-button
      ><el-button @click="state.canvas.scaleSelectedItem(1.1)">放大选中</el-button
      ><el-button @click="state.canvas.scaleSelectedItem(0.9)">缩小选中</el-button>
      <el-button type="primary" @click="run(state.save)">保存草稿</el-button
      ><el-button :disabled="hasDraft || !canvasItems.length" @click="run(state.exportPdf)"
        >导出 PDF</el-button
      ><el-button @click="state.reset">新建空白</el-button></el-form
    >
    <el-pagination
      v-model:current-page="state.attachmentPage.value"
      :page-size="50"
      :total="state.attachmentTotal.value"
      :disabled="busy"
      layout="prev,pager,next,total"
      @current-change="run(state.load)"
    />
    <el-table :data="drafts"
      ><el-table-column prop="name" label="已保存排版" /><el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button :disabled="busy" @click="open(row)">打开</el-button
          ><el-button :disabled="busy" @click="remove(row)">软删除</el-button></template
        ></el-table-column
      ></el-table
    >
    <p>点击图片选中，拖动移动，右下角拖动缩放。共 {{ pages.length }} 页；已保存草稿跨设备共享。</p>
    <el-scrollbar class="app-scroll-region" max-height="700px"
      ><div ref="previewPanelRef" class="paper-panel__preview">
        <div v-for="page in pages" :key="page.index" class="paper-panel__page" :style="pageStyle">
          <div
            v-for="item in page.items"
            :key="item.id"
            class="paper-panel__item"
            :class="{ selected: selectedItem?.id === item.id }"
            :style="{
              left: `${mmToPixelPrecise(item.x)}px`,
              top: `${mmToPixelPrecise(item.localY)}px`,
              width: `${mmToPixelPrecise(item.width)}px`,
              height: `${mmToPixelPrecise(item.height)}px`,
              zIndex: item.zIndex
            }"
            @pointerdown="state.canvas.startMove($event, item)"
          >
            <img :src="item.dataUrl" :alt="item.name" draggable="false" /><span
              class="paper-panel__resize"
              @pointerdown.stop="state.canvas.startResize($event, item)"
            ></span>
          </div>
        </div></div
    ></el-scrollbar>
  </section>
</template>
<style scoped lang="scss">
.paper-panel__preview {
  overflow: visible;

  background: #ddd;
  padding: 20px;
}
.paper-panel__page {
  position: relative;
  background: white;
  overflow: hidden;
  margin: 0 auto 20px;
}
.paper-panel__item {
  position: absolute;
  touch-action: none;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .paper-panel__resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    background: #409eff;
    cursor: nwse-resize;
  }
  &.selected {
    outline: 2px solid #409eff;
  }
}
</style>
