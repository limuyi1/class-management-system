<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'
import { buildExcelDataFromHeaderRow } from '@/utils/xlsxUntil'

import type { ExcelCellValueType, ExcelMergeRangeType } from '@/utils/xlsxUntil'

type ExcelRowType = Record<string, string | number | boolean | null | undefined>

type SelectorModeType = 'initial' | 'incremental' | 'name-only'

interface Props {
  modelValue: boolean
  mode: SelectorModeType
  headers?: string[]
  rows?: ExcelRowType[]
  defaultNameColumn?: string
  previewRows?: ExcelCellValueType[][]
  previewMerges?: ExcelMergeRangeType[]
  suggestedHeaderRowIndex?: number
}

interface ConfirmPayloadType {
  nameColumn?: string
  scoreColumns: string[]
  headerRowIndex?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [value: ConfirmPayloadType]
}>()

const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const selectedNameColumn = ref('')
const selectedScoreColumns = ref<string[]>([])
const selectedHeaderRowIndex = ref(0)

const isInitialMode = computed(() => props.mode === 'initial')
const isNameOnlyMode = computed(() => props.mode === 'name-only')
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
const scoreHeaders = computed(() => {
  return effectiveHeaders.value.filter((header) => {
    if (header === '序号') return false
    return header !== selectedNameColumn.value
  })
})
const canConfirm = computed(
  () =>
    Boolean(selectedNameColumn.value) &&
    (isNameOnlyMode.value || isInitialMode.value || selectedScoreColumns.value.length > 0)
)

const findSuggestedNameColumn = (): string => {
  return (
    props.defaultNameColumn ||
    effectiveHeaders.value.find((header) =>
      ['姓名', '学生姓名', '学生', '名字'].some((pattern) => header.includes(pattern))
    ) ||
    ''
  )
}

/**
 * 当前表头行决定后续列名；切换表头行时必须重置选择，避免旧列名参与导入。
 */
const resetSelections = () => {
  selectedNameColumn.value = findSuggestedNameColumn()
  selectedScoreColumns.value = []
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

watch(selectedNameColumn, () => {
  selectedScoreColumns.value = selectedScoreColumns.value.filter(
    (column) => column !== selectedNameColumn.value
  )
})

const handleConfirm = () => {
  if (!selectedNameColumn.value) {
    ElMessage.warning('请选择姓名列')
    return
  }

  if (!isNameOnlyMode.value && !isInitialMode.value && selectedScoreColumns.value.length === 0) {
    ElMessage.warning('请选择至少一个成绩列')
    return
  }

  emit('confirm', {
    headerRowIndex: hasHeaderPreview.value ? selectedHeaderRowIndex.value : undefined,
    nameColumn: selectedNameColumn.value,
    scoreColumns: [...selectedScoreColumns.value]
  })
}
</script>

<template>
  <el-dialog
    v-model="localVisible"
    :title="isNameOnlyMode ? '选择姓名列' : '选择 Excel 导入列'"
    width="860px"
  >
    <div class="excel-column-selector">
      <excel-header-row-picker
        v-if="hasHeaderPreview"
        v-model="selectedHeaderRowIndex"
        :rows="previewRows ?? []"
        :merges="previewMerges"
      />

      <div class="selector-section">
        <div class="selector-section__head">
          <div class="selector-section__title">姓名列</div>
          <div class="selector-section__desc">
            {{
              isNameOnlyMode
                ? '选择用于名单核对的列'
                : isInitialMode
                  ? '选择用于生成学生姓名的列'
                  : '选择用于匹配系统学生的列'
            }}
          </div>
        </div>
        <el-radio-group v-model="selectedNameColumn" class="column-options">
          <el-radio-button v-for="header in effectiveHeaders" :key="header" :value="header">
            {{ header }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="!isNameOnlyMode" class="selector-section">
        <div class="selector-section__head">
          <div class="selector-section__title">成绩列</div>
          <div class="selector-section__desc">
            {{ isInitialMode ? '选择需要初始化的成绩列（可选）' : '选择需要新增或更新的成绩列' }}
          </div>
        </div>
        <el-checkbox-group v-model="selectedScoreColumns" class="column-options">
          <el-checkbox-button v-for="header in scoreHeaders" :key="header" :value="header">
            {{ header }}
          </el-checkbox-button>
        </el-checkbox-group>
      </div>
    </div>

    <template #footer>
      <el-button @click="localVisible = false">取消</el-button>
      <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">
        {{ isNameOnlyMode ? '确认' : '确认导入' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.excel-column-selector {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.selector-section {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.selector-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.selector-section__title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.selector-section__desc {
  font-size: 13px;
  color: #64748b;
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
  }

  :deep(.el-radio-button.is-active .el-radio-button__inner),
  :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
    color: #fff !important;
    background-color: var(--theme-primary) !important;
    border-color: var(--theme-primary) !important;
    box-shadow: none !important;
  }
}

.preview-section {
  min-width: 0;
}
</style>
