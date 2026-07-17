<script setup lang="ts">
import { nextTick, shallowRef } from 'vue'

import { DutyRosterModeEnum } from '@/types/DutyRoster'

const props = defineProps<{
  rosterName: string
  mode: DutyRosterModeEnum
  fullscreen: boolean
}>()

const emit = defineEmits<{
  rename: [name: string]
  changeMode: [mode: DutyRosterModeEnum]
  manageSections: []
  export: []
  toggleFullscreen: []
}>()

const editingName = shallowRef(false)
const nameDraft = shallowRef('')
const inputRef = shallowRef<HTMLInputElement | null>(null)

async function startRename(): Promise<void> {
  nameDraft.value = props.rosterName
  editingName.value = true
  await nextTick()
  inputRef.value?.select()
}

function commitRename(): void {
  const name = nameDraft.value.trim()
  if (name && name !== props.rosterName) emit('rename', name)
  editingName.value = false
}

function handleModeChange(value: string | number | boolean | undefined): void {
  if (value === DutyRosterModeEnum.Daily || value === DutyRosterModeEnum.Weekly) {
    emit('changeMode', value)
  }
}
</script>

<template>
  <header class="duty-toolbar">
    <div class="duty-toolbar__identity">
      <input
        v-if="editingName"
        ref="inputRef"
        v-model="nameDraft"
        class="duty-toolbar__name-input"
        maxlength="30"
        @blur="commitRename"
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="editingName = false"
      />
      <button v-else class="duty-toolbar__name" type="button" @dblclick="startRename">
        {{ rosterName }}
      </button>
    </div>

    <el-segmented
      class="duty-toolbar__mode"
      :model-value="mode"
      :options="[
        { label: '每组一天', value: DutyRosterModeEnum.Daily },
        { label: '每组一周', value: DutyRosterModeEnum.Weekly }
      ]"
      @change="handleModeChange"
    />

    <div class="duty-toolbar__actions">
      <el-button size="small" @click="emit('manageSections')">
        <font-awesome-icon :icon="['solid', 'gear']" />
        岗位设置
      </el-button>
      <el-button size="small" type="primary" @click="emit('export')">
        <font-awesome-icon :icon="['solid', 'print']" />
        打印预览
      </el-button>
      <el-tooltip :content="fullscreen ? '退出全屏' : '全屏'" placement="bottom">
        <el-button size="small" circle @click="emit('toggleFullscreen')">
          <font-awesome-icon :icon="['solid', fullscreen ? 'compress' : 'expand']" />
        </el-button>
      </el-tooltip>
    </div>
  </header>
</template>

<style scoped lang="scss">
.duty-toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) max-content max-content;
  align-items: center;
  gap: 18px;
  min-height: 48px;
  height: 48px;
  padding: 0 14px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid #ece8f2;
}

.duty-toolbar__identity,
.duty-toolbar__actions {
  display: flex;
  align-items: center;
  min-width: 0;
}

.duty-toolbar__identity {
  gap: 10px;
}

.duty-toolbar__name {
  max-width: 260px;
  padding: 3px 0;
  overflow: hidden;
  color: #1f2a44;
  background: none;
  border: 0;
  font-size: 15px;
  font-weight: 700;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}

.duty-toolbar__name-input {
  width: 220px;
  height: 30px;
  padding: 0 9px;
  color: #1f2a44;
  background: #fff;
  border: 1px solid var(--theme-primary);
  border-radius: 7px;
  font: inherit;
  font-weight: 700;
  outline: 0;
}

.duty-toolbar__mode {
  --el-segmented-item-selected-color: var(--theme-primary);
  --el-segmented-item-selected-bg-color: #fff;
  height: 30px;
  box-sizing: border-box;
  padding: 2px;
  border: 1px solid #e2dced;
  background: #f8f6fb;
}

.duty-toolbar__mode :deep(.el-segmented__item) {
  min-height: 24px;
  height: 24px;
  padding: 0 9px;
  font-size: 11px;
}

.duty-toolbar__actions {
  justify-content: flex-end;
  flex: none;
  gap: 8px;
}

.duty-toolbar__actions :deep(.el-button) {
  min-height: 28px;
  height: 28px;
  flex: none;
  padding: 0 10px;
  font-size: 11px;
  margin-left: 0;
}

.duty-toolbar__actions :deep(.el-button.is-circle) {
  width: 28px;
  min-width: 28px;
  padding: 6px;
}

@media (max-width: 1260px) {
  .duty-toolbar {
    gap: 10px;
  }
}
</style>
