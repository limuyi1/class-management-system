<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import type { ExcelRowType } from '@/utils/scoreImportUntil'

type SelectorModeType = 'initial' | 'incremental'

interface Props {
  modelValue: boolean
  mode: SelectorModeType
  headers: string[]
  rows: ExcelRowType[]
}

interface ConfirmPayloadType {
  nameColumn?: string
  scoreColumns: string[]
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

const isInitialMode = computed(() => props.mode === 'initial')
const previewRows = computed(() => props.rows.slice(0, 5))
const scoreHeaders = computed(() => {
  return props.headers.filter((header) => {
    if (header === '序号') return false
    if (!isInitialMode.value && header === '姓名') return false
    return header !== selectedNameColumn.value
  })
})

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    selectedNameColumn.value = props.headers.includes('姓名') ? '姓名' : ''
    selectedScoreColumns.value = []
  }
)

watch(selectedNameColumn, () => {
  selectedScoreColumns.value = selectedScoreColumns.value.filter(
    (column) => column !== selectedNameColumn.value
  )
})

const handleConfirm = () => {
  if (isInitialMode.value && !selectedNameColumn.value) {
    ElMessage.warning('请选择姓名列')
    return
  }

  if (selectedScoreColumns.value.length === 0) {
    ElMessage.warning('请选择至少一个成绩列')
    return
  }

  emit('confirm', {
    nameColumn: selectedNameColumn.value,
    scoreColumns: [...selectedScoreColumns.value]
  })
}
</script>

<template>
  <el-dialog v-model="localVisible" title="选择 Excel 导入列" width="860px">
    <div class="excel-column-selector">
      <div class="selector-section" v-if="isInitialMode">
        <div class="selector-section__head">
          <div class="selector-section__title">姓名列</div>
          <div class="selector-section__desc">选择用于生成学生姓名的列</div>
        </div>
        <el-radio-group v-model="selectedNameColumn" class="column-options">
          <el-radio-button v-for="header in headers" :key="header" :label="header" />
        </el-radio-group>
      </div>

      <div class="selector-section">
        <div class="selector-section__head">
          <div class="selector-section__title">成绩列</div>
          <div class="selector-section__desc">
            {{ isInitialMode ? '选择需要初始化的成绩列' : '选择需要新增或更新的成绩列' }}
          </div>
        </div>
        <el-checkbox-group v-model="selectedScoreColumns" class="column-options">
          <el-checkbox-button v-for="header in scoreHeaders" :key="header" :label="header" />
        </el-checkbox-group>
      </div>

      <div class="preview-section">
        <div class="selector-section__head">
          <div class="selector-section__title">数据预览</div>
          <div class="selector-section__desc">仅展示前 5 行，用于确认列内容</div>
        </div>
        <el-table :data="previewRows" border height="260">
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
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  :deep(.el-radio-button__inner),
  :deep(.el-checkbox-button__inner) {
    color: #1f2937 !important;
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
