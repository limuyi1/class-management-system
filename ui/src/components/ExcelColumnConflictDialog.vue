<script setup lang="ts">
import { reactive, watch } from 'vue'

import type { ConflictActionType } from '@/utils/scoreImportUtil'

/**
 * 同名成绩列冲突处理弹窗。
 *
 * 导入时若存在与现有成绩同名的列，弹出本组件让用户对每列选择「覆盖」或「跳过」，
 * 确认后回传列名到处理方式的映射。
 */
interface Props {
  /** 弹窗是否可见 */
  modelValue: boolean
  /** 冲突的成绩列名列表 */
  columns: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 弹窗可见状态变化 */
  'update:modelValue': [value: boolean]
  /** 确认处理，回传列名到处理方式的映射 */
  confirm: [value: Record<string, ConflictActionType>]
  /** 取消导入 */
  cancel: []
}>()

/** 各冲突列选择的处理方式（覆盖 / 跳过） */
const actions = reactive<Record<string, ConflictActionType>>({})

// 弹窗打开时重置每列的默认选择策略
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    // 每次打开都清空旧选择，并为每个冲突列重置默认策略「跳过」
    Object.keys(actions).forEach((key) => {
      delete actions[key]
    })
    props.columns.forEach((column) => {
      actions[column] = 'skip'
    })
  }
)

/**
 * 关闭弹窗并通知取消导入
 */
const closeDialog = () => {
  emit('update:modelValue', false)
  emit('cancel')
}

/**
 * 回传各冲突列选择的处理方式
 */
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

      <!-- 冲突列逐项选择处理方式 -->
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
