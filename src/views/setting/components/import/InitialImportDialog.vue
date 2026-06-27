<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'
import { buildExcelDataFromHeaderRow } from '@/utils/xlsxUntil'

import type { ExcelRowType } from '@/utils/scoreImportUntil'
import type { ExcelCellValueType, ExcelMergeRangeType } from '@/utils/xlsxUntil'
import type { InitialImportSelectionType } from '@/types/StudentImport'

interface Props {
  modelValue: boolean
  headers?: string[]
  rows?: ExcelRowType[]
  previewRows?: ExcelCellValueType[][]
  previewMerges?: ExcelMergeRangeType[]
  suggestedHeaderRowIndex?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [value: InitialImportSelectionType & { headerRowIndex?: number }]
}>()

const selectedHeaderRowIndex = ref(0)
const selectedNameColumn = ref('')
const selectedScoreColumns = ref<string[]>([])
const selectedCommentColumn = ref('')
const hasHeaderPreview = computed(() => Boolean(props.previewRows?.length))
const parsedImportData = computed(() => {
  if (!hasHeaderPreview.value) {
    return {
      header: props.headers ?? [],
      data: props.rows ?? []
    }
  }
  return buildExcelDataFromHeaderRow(props.previewRows ?? [], selectedHeaderRowIndex.value)
})
const effectiveHeaders = computed(() => parsedImportData.value.header)
const availableScoreColumns = computed(() =>
  effectiveHeaders.value.filter(
    (header) =>
      header !== '序号' &&
      header !== selectedNameColumn.value &&
      header !== selectedCommentColumn.value
  )
)
const availableCommentColumns = computed(() =>
  effectiveHeaders.value.filter(
    (header) =>
      header !== '序号' &&
      header !== selectedNameColumn.value &&
      !selectedScoreColumns.value.includes(header)
  )
)

const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const findSuggestedColumn = (patterns: string[]): string =>
  effectiveHeaders.value.find((header) => patterns.some((pattern) => header.includes(pattern))) ||
  ''

/**
 * 表头行变化后重新套用默认列推荐，避免保留上一行生成的旧字段名。
 */
const resetSelections = () => {
  selectedNameColumn.value = findSuggestedColumn(['姓名', '学生姓名', '学生', '名字'])
  selectedScoreColumns.value = []
  selectedCommentColumn.value = findSuggestedColumn(['期末评语', '评语'])
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    selectedHeaderRowIndex.value = props.suggestedHeaderRowIndex ?? 0
    resetSelections()
  }
)

watch(selectedHeaderRowIndex, () => {
  resetSelections()
})

watch(selectedNameColumn, (column) => {
  selectedScoreColumns.value = selectedScoreColumns.value.filter((item) => item !== column)
  if (selectedCommentColumn.value === column) selectedCommentColumn.value = ''
})

watch(selectedCommentColumn, (column) => {
  selectedScoreColumns.value = selectedScoreColumns.value.filter((item) => item !== column)
})

watch(selectedScoreColumns, (columns) => {
  if (selectedCommentColumn.value && columns.includes(selectedCommentColumn.value)) {
    selectedCommentColumn.value = ''
  }
})

/**
 * 评语列是可选单选：点击其他列时切换，重复点击当前列时取消选择。
 */
const handleCommentColumnChange = (columns: Array<string | number>) => {
  selectedCommentColumn.value = columns.length ? String(columns[columns.length - 1]) : ''
}

const handleConfirm = () => {
  if (!selectedNameColumn.value) {
    ElMessage.warning('请选择姓名列')
    return
  }

  emit('confirm', {
    headerRowIndex: hasHeaderPreview.value ? selectedHeaderRowIndex.value : undefined,
    nameColumn: selectedNameColumn.value,
    scoreColumns: [...selectedScoreColumns.value],
    commentColumn: selectedCommentColumn.value || undefined
  })
}
</script>

<template>
  <el-dialog v-model="localVisible" title="导入学生信息" width="860px">
    <div class="initial-import-dialog">
      <excel-header-row-picker
        v-if="hasHeaderPreview"
        v-model="selectedHeaderRowIndex"
        :rows="previewRows ?? []"
        :merges="previewMerges"
      />

      <div class="column-section">
        <div class="column-section__head">
          <div class="column-section__title">姓名列</div>
          <div class="column-section__description">必选且只能选择一列</div>
        </div>
        <el-radio-group v-model="selectedNameColumn" class="column-options">
          <el-radio-button v-for="header in effectiveHeaders" :key="header" :value="header">
            {{ header }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="column-section">
        <div class="column-section__head">
          <div class="column-section__title">成绩列</div>
          <div class="column-section__description">可多选，也可以不选择</div>
        </div>
        <el-checkbox-group v-model="selectedScoreColumns" class="column-options">
          <el-checkbox-button v-for="header in availableScoreColumns" :key="header" :value="header">
            {{ header }}
          </el-checkbox-button>
        </el-checkbox-group>
      </div>

      <div class="column-section">
        <div class="column-section__head">
          <div class="column-section__title">评语列</div>
          <div class="column-section__description">可选且最多选择一列</div>
        </div>
        <el-checkbox-group
          :model-value="selectedCommentColumn ? [selectedCommentColumn] : []"
          class="column-options"
          @change="handleCommentColumnChange"
        >
          <el-checkbox-button
            v-for="header in availableCommentColumns"
            :key="header"
            :value="header"
          >
            {{ header }}
          </el-checkbox-button>
        </el-checkbox-group>
      </div>
    </div>

    <template #footer>
      <el-button @click="localVisible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确认导入</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.initial-import-dialog {
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

  :deep(.el-radio-button__inner),
  :deep(.el-checkbox-button__inner) {
    min-width: 82px;
    color: #1f2937 !important;
    white-space: nowrap;
    background-color: #fff !important;
    border-left: var(--el-border) !important;
    border-radius: 6px !important;
    box-shadow: none !important;
  }

  :deep(.el-radio-button.is-active .el-radio-button__inner),
  :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
    color: #fff !important;
    background-color: var(--theme-primary) !important;
    border-color: var(--theme-primary) !important;
  }
}

.initial-import-dialog__preview-title {
  margin-bottom: 10px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 700;
}
</style>
