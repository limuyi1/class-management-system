<script setup lang="ts">
/** 试卷排版工具栏：展示设置与操作入口，画布和文件操作由父组件执行。 */
import { PagesEnum } from '@/types/Common'

import type { PaperLayoutOrientationType, PaperLayoutSettingsType } from '@/types/Tools'

const settings = defineModel<PaperLayoutSettingsType>('settings', { required: true })

defineProps<{
  fullscreen?: boolean
  uploading: boolean
  exporting: boolean
  itemCount: number
  hasSelection: boolean
  draftCount: number
}>()

const emit = defineEmits<{
  addImage: [command: string | number | object]
  autoArrange: []
  orientationChange: [orientation: PaperLayoutOrientationType]
  scaleSelected: [factor: number]
  removeSelected: []
  clear: []
  saveDraft: []
  openDraft: []
  exportPdf: []
  toggleFullscreen: []
}>()
</script>

<template>
  <div class="layout-toolbar">
    <el-dropdown
      trigger="click"
      @command="(command: string | number | object) => emit('addImage', command)"
    >
      <el-button type="primary" size="small" :loading="uploading">
        <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
        添加图片
        <font-awesome-icon class="button-caret" :icon="['solid', 'chevron-down']" />
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="upload">
            <font-awesome-icon :icon="['solid', 'cloud-arrow-up']" />
            直接上传图片
          </el-dropdown-item>
          <el-dropdown-item command="library">
            <font-awesome-icon :icon="['solid', 'images']" />
            从素材库选择
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-button size="small" :disabled="itemCount === 0" @click="emit('autoArrange')">
      <template #icon><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" /></template>
      重新自动排版
    </el-button>

    <el-divider direction="vertical" />

    <el-select v-model="settings.pageType" size="small" class="toolbar-select">
      <el-option label="A4" :value="PagesEnum.A4" />
      <el-option label="A3" :value="PagesEnum.A3" />
      <el-option label="B4" :value="PagesEnum.B4" />
      <el-option label="B3" :value="PagesEnum.B3" />
    </el-select>
    <el-segmented
      :model-value="settings.orientation"
      size="small"
      :options="[
        { label: '纵向', value: 'portrait' },
        { label: '横向', value: 'landscape' }
      ]"
      @change="emit('orientationChange', $event)"
    />
    <el-segmented
      v-model="settings.layoutMode"
      size="small"
      :options="[
        { label: '一页一张', value: 'single' },
        { label: '一页两张', value: 'double' },
        { label: '自由', value: 'free' }
      ]"
    />

    <template v-if="settings.layoutMode === 'free'">
      <span class="toolbar-field-label">边距</span>
      <el-input-number
        v-model="settings.margin"
        size="small"
        class="toolbar-number"
        :min="0"
        :max="20"
        :step="1"
        controls-position="right"
      />
      <span class="toolbar-field-label">间距</span>
      <el-input-number
        v-model="settings.gap"
        size="small"
        class="toolbar-number"
        :min="0"
        :max="10"
        :step="1"
        controls-position="right"
      />
    </template>

    <el-divider direction="vertical" />

    <!-- 选中项操作：每次按 0.9 / 1.1 倍缩放或删除当前选中图片 -->
    <el-button
      class="selected-item-action"
      size="small"
      :disabled="!hasSelection"
      @click="emit('scaleSelected', 0.9)"
    >
      <template #icon><font-awesome-icon :icon="['solid', 'magnifying-glass-minus']" /></template>
    </el-button>
    <el-button
      class="selected-item-action"
      size="small"
      :disabled="!hasSelection"
      @click="emit('scaleSelected', 1.1)"
    >
      <template #icon><font-awesome-icon :icon="['solid', 'magnifying-glass-plus']" /></template>
    </el-button>
    <el-button
      class="selected-item-action"
      size="small"
      :disabled="!hasSelection"
      @click="emit('removeSelected')"
    >
      <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
    </el-button>

    <div class="toolbar-spacer" />

    <el-button size="small" :disabled="itemCount === 0" @click="emit('clear')">清空</el-button>
    <el-button size="small" :disabled="itemCount === 0" @click="emit('saveDraft')">
      <template #icon><font-awesome-icon :icon="['solid', 'floppy-disk']" /></template>
      保存草稿
    </el-button>
    <el-button v-if="draftCount > 0" size="small" @click="emit('openDraft')">
      <template #icon><font-awesome-icon :icon="['solid', 'folder-open']" /></template>
      打开草稿
    </el-button>
    <el-button
      type="primary"
      size="small"
      :loading="exporting"
      :disabled="itemCount === 0"
      @click="emit('exportPdf')"
    >
      <template #icon><font-awesome-icon :icon="['solid', 'file-pdf']" /></template>
      导出 PDF
    </el-button>
    <el-button size="small" circle @click="emit('toggleFullscreen')">
      <font-awesome-icon
        :icon="[
          'solid',
          fullscreen ? 'down-left-and-up-right-to-center' : 'up-right-and-down-left-from-center'
        ]"
      />
    </el-button>
  </div>
</template>

<style scoped lang="scss">
.button-caret {
  margin-left: 2px;
  font-size: 10px;
}

.layout-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.toolbar-select {
  width: 88px;
}

.toolbar-number {
  width: 86px;
}

.toolbar-field-label {
  color: #6b7280;
  font-size: 12px;
}

.toolbar-spacer {
  flex: 1;
}
</style>
