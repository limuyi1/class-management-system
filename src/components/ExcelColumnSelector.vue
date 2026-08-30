<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'
import { buildExcelDataFromHeaderRow } from '@/utils/xlsxUtil'

import type { ExcelCellValueType, ExcelMergeRangeType } from '@/utils/xlsxUtil'

/**
 * Excel 导入列选择弹窗。
 *
 * 根据导入模式（初始化 / 增量 / 仅姓名）引导用户选择姓名列与成绩列，
 * 支持先挑选表头行再确定列名，确认后以 payload 形式返回选择结果。
 */
/** Excel 数据行：单元格值类型联合 */
type ExcelRowType = Record<string, string | number | boolean | null | undefined>

/** 选择器模式：初始化 / 增量 / 仅姓名 */
type SelectorModeType = 'initial' | 'incremental' | 'name-only'

interface Props {
  /** 弹窗是否可见 */
  modelValue: boolean
  /** 导入模式 */
  mode: SelectorModeType
  /** 表头列表（无预览数据时直接使用） */
  headers?: string[]
  /** 数据行（无预览数据时直接使用） */
  rows?: ExcelRowType[]
  /** 外部指定的默认姓名列 */
  defaultNameColumn?: string
  /** 预览的原始行数据 */
  previewRows?: ExcelCellValueType[][]
  /** 预览的合并单元格信息 */
  previewMerges?: ExcelMergeRangeType[]
  /** 推荐的表头行索引 */
  suggestedHeaderRowIndex?: number
}

/** 确认回调载荷 */
interface ConfirmPayloadType {
  /** 选中的姓名列 */
  nameColumn?: string
  /** 选中的成绩列列表 */
  scoreColumns: string[]
  /** 表头行索引（仅存在预览数据时回传） */
  headerRowIndex?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 弹窗可见状态变化 */
  'update:modelValue': [value: boolean]
  /** 确认列选择结果 */
  confirm: [value: ConfirmPayloadType]
}>()

/** 弹窗可见状态的本地代理，与父级 v-model 双向同步 */
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

/** 选中的姓名列 */
const selectedNameColumn = ref('')
/** 选中的成绩列列表 */
const selectedScoreColumns = ref<string[]>([])
/** 选中的表头行索引 */
const selectedHeaderRowIndex = ref(0)

/** 是否初始化模式 */
const isInitialMode = computed(() => props.mode === 'initial')
/** 是否仅姓名模式 */
const isNameOnlyMode = computed(() => props.mode === 'name-only')
/** 是否存在预览行数据 */
const hasHeaderPreview = computed(() => Boolean(props.previewRows?.length))
// 有预览行时按所选表头行解析，否则直接使用外部传入的表头与数据
const parsedImportData = computed(() => {
  if (!hasHeaderPreview.value) {
    return {
      header: props.headers ?? [],
      data: props.rows ?? []
    }
  }
  return buildExcelDataFromHeaderRow(props.previewRows ?? [], selectedHeaderRowIndex.value)
})
/** 当前可用的表头列表 */
const effectiveHeaders = computed(() => parsedImportData.value.header)
// 成绩列候选：排除「序号」占位列以及已选为姓名的列
const scoreHeaders = computed(() => {
  return effectiveHeaders.value.filter((header) => {
    if (header === '序号') return false
    return header !== selectedNameColumn.value
  })
})
// 仅姓名模式无需成绩列；其他模式必须有姓名列（初始模式允许不选成绩列）
const canConfirm = computed(
  () =>
    Boolean(selectedNameColumn.value) &&
    (isNameOnlyMode.value || isInitialMode.value || selectedScoreColumns.value.length > 0)
)

/**
 * 推断默认姓名列：优先使用外部指定值，其次匹配常见姓名表头关键词
 * @returns 匹配到的列名，未命中时返回空字符串
 */
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

// 弹窗打开时重置表头行索引与列选择
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    selectedHeaderRowIndex.value = props.suggestedHeaderRowIndex ?? 0
    resetSelections()
  }
)

// 表头行切换后重新推断默认列并清空选择
watch(selectedHeaderRowIndex, () => {
  resetSelections()
})

watch(selectedNameColumn, () => {
  // 姓名列变化后同步剔除成绩列中可能存在的同名项，保证两类列互斥
  selectedScoreColumns.value = selectedScoreColumns.value.filter(
    (column) => column !== selectedNameColumn.value
  )
})

/**
 * 校验选择结果并派发确认事件
 */
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
      <!-- 表头行选择（仅存在预览数据时展示） -->
      <excel-header-row-picker
        v-if="hasHeaderPreview"
        v-model="selectedHeaderRowIndex"
        :rows="previewRows ?? []"
        :merges="previewMerges"
      />

      <!-- 姓名列选择 -->
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

      <!-- 成绩列选择（仅姓名模式不展示） -->
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
