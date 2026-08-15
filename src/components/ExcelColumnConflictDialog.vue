<script setup lang="ts">
import { reactive, watch } from 'vue'

import type { ConflictActionType } from '@/utils/scoreImportUtil'

interface Props {
  modelValue: boolean
  columns: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [value: Record<string, ConflictActionType>]
  cancel: []
}>()

const actions = reactive<Record<string, ConflictActionType>>({})

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    Object.keys(actions).forEach((key) => {
      delete actions[key]
    })
    props.columns.forEach((column) => {
      actions[column] = 'skip'
    })
  }
)

const closeDialog = () => {
  emit('update:modelValue', false)
  emit('cancel')
}

const handleConfirm = () => {
  emit('confirm', { ...actions })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="处理同名成绩列"
    width="560px"
    :close-on-click-modal="false"
    @update:model-value="(value: boolean) => !value && closeDialog()"
  >
    <div class="conflict-dialog">
      <div class="conflict-dialog__tip">以下成绩列已存在，请选择覆盖已有成绩或跳过该列。</div>

      <div class="conflict-list">
        <div v-for="column in columns" :key="column" class="conflict-item">
          <div class="conflict-item__name">{{ column }}</div>
          <el-radio-group v-model="actions[column]" size="small">
            <el-radio-button value="overwrite">覆盖</el-radio-button>
            <el-radio-button value="skip">跳过</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="closeDialog">取消导入</el-button>
      <el-button type="primary" @click="handleConfirm">继续导入</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.conflict-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conflict-dialog__tip {
  padding: 12px 14px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 14px;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.conflict-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.conflict-item__name {
  min-width: 0;
  color: #1f2937;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-radio-button__inner) {
  color: #1f2937 !important;
  background-color: #fff !important;
}

:deep(.el-radio-button.is-active .el-radio-button__inner) {
  color: #fff !important;
  background-color: var(--theme-primary) !important;
  border-color: var(--theme-primary) !important;
  box-shadow: none !important;
}
</style>
