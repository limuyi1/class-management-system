<script setup lang="ts">
import { ref } from 'vue'

import CardSettingsPanel from './CardSettingsPanel.vue'
import CardLayerPanel from './CardLayerPanel.vue'
import { createCardTemplate } from '@/utils/cardTemplateUtil'

import type { CardTemplateType } from '@/types/PrintTools'

const template = defineModel<CardTemplateType>('template', { required: true })
const globals = defineModel<Record<string, string>>('globals', { required: true })
const selectedLayerId = defineModel<string>('selectedLayerId', { required: true })
defineProps<{ busy: boolean; fieldNames: string[]; saved: boolean }>()
const emit = defineEmits<{
  material: [mode: 'background' | 'image' | 'replace', library?: boolean]
  addText: []
  reorder: [offset: number]
  choose: [template: CardTemplateType]
  saveCopy: []
  delete: []
}>()
const tabName = ref('layers')
</script>
<template>
  <p class="card-advanced__hint">
    点击右侧文字或图片可选择图层，用手柄调整位置。日常套用模板无需修改这里。
  </p>
  <el-tabs v-model="tabName">
    <el-tab-pane label="图层编辑" name="layers">
      <div class="card-advanced__buttons">
        <el-button size="small" :disabled="busy" @click="emit('addText')">添加文字</el-button>
        <el-button size="small" :disabled="busy" @click="emit('material', 'image')"
          >上传图片</el-button
        >
        <el-button size="small" :disabled="busy" @click="emit('material', 'image', true)"
          >素材库</el-button
        >
      </div>
      <CardLayerPanel
        v-model:template="template"
        v-model:selected-layer-id="selectedLayerId"
        :busy="busy"
        :field-names="fieldNames"
        @reorder="emit('reorder', $event)"
        @replace="emit('material', 'replace')"
      />
    </el-tab-pane>
    <el-tab-pane label="纸张与背景" name="paper">
      <CardSettingsPanel
        v-model:template="template"
        v-model:globals="globals"
        :busy="busy"
        layout-only
        @upload="emit('material', 'background')"
        @library="emit('material', 'background', true)"
      />
      <div class="card-advanced__buttons">
        <el-button :disabled="busy" @click="emit('choose', createCardTemplate('blank'))"
          >新建空白模板</el-button
        >
        <el-button :disabled="busy" @click="emit('saveCopy')">另存副本</el-button>
        <el-button v-if="saved" type="danger" plain :disabled="busy" @click="emit('delete')"
          >删除已存模板</el-button
        >
      </div>
    </el-tab-pane>
  </el-tabs>
</template>
<style scoped lang="scss">
.card-advanced__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 12px;
}
.card-advanced__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.card-advanced__buttons :deep(.el-button) {
  margin-left: 0;
}
</style>
