<script setup lang="ts">
import { computed } from 'vue'

import type { ExcelCellValueType, ExcelMergeRangeType } from '@/utils/xlsxUntil'

interface Props {
  modelValue: number
  rows: ExcelCellValueType[][]
  merges?: ExcelMergeRangeType[]
}

const PREVIEW_ROW_COUNT = 8

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const previewRows = computed(() => props.rows.slice(0, PREVIEW_ROW_COUNT))
const previewColumnIndexes = computed(() => {
  const columnCount = previewRows.value.reduce((count, row) => Math.max(count, row.length), 0)
  return Array.from({ length: columnCount }, (_, index) => index)
})
const previewMerges = computed(() =>
  (props.merges ?? []).filter(
    (merge) => merge.startRow < PREVIEW_ROW_COUNT && merge.startColumn < previewColumnIndexes.value.length
  )
)

const tableRows = computed(() =>
  previewRows.value.map((row, rowIndex) => {
    const result: Record<string, ExcelCellValueType | number> = {
      rowNumber: rowIndex + 1,
      rowIndex
    }

    previewColumnIndexes.value.forEach((columnIndex) => {
      result[`column_${columnIndex}`] = row[columnIndex] ?? ''
    })

    return result
  })
)

const handleRowClick = (row: Record<string, ExcelCellValueType | number>) => {
  emit('update:modelValue', Number(row.rowIndex))
}

const getRowClassName = ({ row }: { row: Record<string, ExcelCellValueType | number> }) => {
  return Number(row.rowIndex) === props.modelValue ? 'is-selected-header-row' : ''
}

const findMergeAtCell = (rowIndex: number, columnIndex: number) => {
  return previewMerges.value.find(
    (merge) =>
      rowIndex >= merge.startRow &&
      rowIndex <= merge.endRow &&
      columnIndex >= merge.startColumn &&
      columnIndex <= merge.endColumn
  )
}

/**
 * 只在预览层还原 Excel 合并单元格，便于用户判断表头行；
 * 导入规则仍然只使用用户点击的单行字段名，不拼接上级表头。
 */
const getCellSpan = ({
  rowIndex,
  columnIndex
}: {
  rowIndex: number
  columnIndex: number
}) => {
  if (columnIndex === 0) {
    return { rowspan: 1, colspan: 1 }
  }

  const excelColumnIndex = columnIndex - 1
  const merge = findMergeAtCell(rowIndex, excelColumnIndex)
  if (!merge) {
    return { rowspan: 1, colspan: 1 }
  }

  if (merge.startRow !== rowIndex || merge.startColumn !== excelColumnIndex) {
    return { rowspan: 0, colspan: 0 }
  }

  return {
    rowspan: Math.min(merge.endRow, PREVIEW_ROW_COUNT - 1) - merge.startRow + 1,
    colspan:
      Math.min(merge.endColumn, previewColumnIndexes.value.length - 1) - merge.startColumn + 1
  }
}

const getCellClassName = ({
  rowIndex,
  columnIndex
}: {
  rowIndex: number
  columnIndex: number
}) => {
  if (columnIndex === 0) return ''

  const merge = findMergeAtCell(rowIndex, columnIndex - 1)
  return merge ? 'is-merged-cell' : ''
}
</script>

<template>
  <div class="excel-header-row-picker">
    <div class="excel-header-row-picker__head">
      <div class="excel-header-row-picker__title">选择表头行</div>
      <div class="excel-header-row-picker__description">
        点击预览中的一行作为字段名行，数据将从下一行开始读取。
      </div>
    </div>
    <el-table
      :data="tableRows"
      border
      height="280"
      highlight-current-row
      :row-class-name="getRowClassName"
      :cell-class-name="getCellClassName"
      :span-method="getCellSpan"
      @row-click="handleRowClick"
    >
      <el-table-column prop="rowNumber" label="行号" width="72" fixed />
      <el-table-column
        v-for="columnIndex in previewColumnIndexes"
        :key="columnIndex"
        :prop="`column_${columnIndex}`"
        :label="`列 ${columnIndex + 1}`"
        min-width="120"
        show-overflow-tooltip
      />
    </el-table>
  </div>
</template>

<style scoped lang="scss">
.excel-header-row-picker {
  min-width: 0;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.excel-header-row-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.excel-header-row-picker__title {
  color: #1f2937;
  font-size: 15px;
  font-weight: 700;
}

.excel-header-row-picker__description {
  color: #64748b;
  font-size: 13px;
}

:deep(.is-selected-header-row) {
  --el-table-tr-bg-color: #ecfdf5;

  td {
    color: #065f46;
    font-weight: 700;
  }
}

:deep(.is-merged-cell) {
  text-align: center;
  vertical-align: middle;

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    text-align: center;
  }
}
</style>
