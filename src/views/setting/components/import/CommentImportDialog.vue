<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import type { ExcelRowType } from '@/utils/scoreImportUntil'
import type { CommentImportSelectionType, CommentImportStrategyType } from '@/types/StudentImport'

interface Props {
  modelValue: boolean
  headers: string[]
  rows: ExcelRowType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [value: CommentImportSelectionType]
}>()

const selectedNameColumn = ref('')
const selectedCommentColumn = ref('')
const strategy = ref<CommentImportStrategyType>('fill-empty')
const previewRows = computed(() => props.rows.slice(0, 5))
const commentColumns = computed(() =>
  props.headers.filter((header) => header !== selectedNameColumn.value && header !== '序号')
)
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const findSuggestedColumn = (patterns: string[]): string =>
  props.headers.find((header) => patterns.some((pattern) => header.includes(pattern))) || ''

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    selectedNameColumn.value = findSuggestedColumn(['姓名', '名字'])
    selectedCommentColumn.value = findSuggestedColumn(['期末评语', '评语'])
    strategy.value = 'fill-empty'
  }
)

watch(selectedNameColumn, (column) => {
  if (selectedCommentColumn.value === column) selectedCommentColumn.value = ''
})

const handleConfirm = () => {
  if (!selectedNameColumn.value) {
    ElMessage.warning('请选择姓名列')
    return
  }
  if (!selectedCommentColumn.value) {
    ElMessage.warning('请选择评语列')
    return
  }

  emit('confirm', {
    nameColumn: selectedNameColumn.value,
    commentColumn: selectedCommentColumn.value,
    strategy: strategy.value
  })
}
</script>

<template>
  <el-dialog v-model="localVisible" title="添加评语" width="760px">
    <div class="comment-import-dialog">
      <div class="column-section">
        <div class="column-section__head">
          <div class="column-section__title">姓名列</div>
          <div class="column-section__description">必选且只能选择一列</div>
        </div>
        <el-radio-group v-model="selectedNameColumn" class="column-options">
          <el-radio-button v-for="header in headers" :key="header" :value="header">
            {{ header }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="column-section">
        <div class="column-section__head">
          <div class="column-section__title">评语列</div>
          <div class="column-section__description">必选且只能选择一列</div>
        </div>
        <el-radio-group v-model="selectedCommentColumn" class="column-options">
          <el-radio-button v-for="header in commentColumns" :key="header" :value="header">
            {{ header }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="column-section">
        <div class="column-section__head">
          <div class="column-section__title">写入方式</div>
          <div class="column-section__description">Excel 空白内容不会覆盖已有评语</div>
        </div>
        <el-radio-group v-model="strategy" class="write-strategy-options">
          <el-radio-button value="fill-empty">仅填充空白评语（推荐）</el-radio-button>
          <el-radio-button value="overwrite">覆盖已有评语</el-radio-button>
        </el-radio-group>
        <el-alert
          v-if="strategy === 'overwrite'"
          class="comment-import-dialog__warning"
          title="只会使用 Excel 中的非空评语覆盖，空单元格不会清空已有评语。"
          type="warning"
          :closable="false"
          show-icon
        />
      </div>

      <div>
        <div class="comment-import-dialog__preview-title">数据预览（前 5 行）</div>
        <el-table :data="previewRows" border height="230">
          <el-table-column
            v-for="header in headers"
            :key="header"
            :prop="header"
            :label="header"
            min-width="120"
            show-overflow-tooltip
          />
        </el-table>
      </div>
    </div>

    <template #footer>
      <el-button @click="localVisible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确认导入</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.comment-import-dialog {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.column-section {
  min-width: 0;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.column-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.column-section__title {
  color: #1f2937;
  font-size: 15px;
  font-weight: 700;
}

.column-section__description {
  color: #64748b;
  font-size: 13px;
}

.column-options {
  display: grid !important;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  grid-template-rows: minmax(32px, auto);
  gap: 8px;
  width: 100%;
  padding: 2px 1px 7px;
  overflow-x: auto;
  overflow-y: hidden;
}

.column-options,
.write-strategy-options {
  :deep(.el-radio-button__inner) {
    min-width: 82px;
    color: #1f2937 !important;
    white-space: nowrap;
    background-color: #fff !important;
    border-left: var(--el-border) !important;
    border-radius: 6px !important;
    box-shadow: none !important;
  }

  :deep(.el-radio-button.is-active .el-radio-button__inner) {
    color: #fff !important;
    background-color: var(--theme-primary) !important;
    border-color: var(--theme-primary) !important;
  }
}

.write-strategy-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.comment-import-dialog__warning {
  margin-top: 10px;
}

.comment-import-dialog__preview-title {
  margin-bottom: 10px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 700;
}
</style>
