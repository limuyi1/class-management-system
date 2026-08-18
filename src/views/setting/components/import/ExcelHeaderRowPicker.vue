<script setup lang="ts">
/**
 * 表头行选择器：以表格形式预览 Excel 前几行（含合并单元格还原），
 * 供用户点击选中某一行作为字段名行。
 */
import { computed } from 'vue'

import type { ExcelCellValueType, ExcelMergeRangeType } from '@/utils/xlsxUtil'

interface Props {
  modelValue: number
  rows: ExcelCellValueType[][]
  merges?: ExcelMergeRangeType[]
}

/** 预览的行数上限 */
const PREVIEW_ROW_COUNT = 8

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

/** 仅截取前 N 行用于预览 */
const previewRows = computed(() => props.rows.slice(0, PREVIEW_ROW_COUNT))
/** 根据预览行宽度生成列索引列表 */
const previewColumnIndexes = computed(() => {
  const columnCount = previewRows.value.reduce((count, row) => Math.max(count, row.length), 0)
  return Array.from({ length: columnCount }, (_, index) => index)
})
/** 仅保留位于预览范围内的合并区域 */
const previewMerges = computed(() =>
  (props.merges ?? []).filter(
    (merge) => merge.startRow < PREVIEW_ROW_COUNT && merge.startColumn < previewColumnIndexes.value.length
  )
)

/** 将预览数据构造成 el-table 的行对象，首列为行号 */
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

/**
 * 点击某行时回传其行索引作为选中的表头行。
 * @param row - 表格行对象
 */
const handleRowClick = (row: Record<string, ExcelCellValueType | number>) => {
  emit('update:modelValue', Number(row.rowIndex))
}

/** 高亮当前选中的表头行 */
const getRowClassName = ({ row }: { row: Record<string, ExcelCellValueType | number> }) => {
  return Number(row.rowIndex) === props.modelValue ? 'is-selected-header-row' : ''
}

/**
 * 查找覆盖指定单元格的合并区域。
 * @param rowIndex - 行索引
 * @param columnIndex - 列索引
 * @returns 命中的合并区域，未命中返回 undefined
 */
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

  // 仅合并区域的起始单元格返回跨度，其余单元格隐藏
  if (merge.startRow !== rowIndex || merge.startColumn !== excelColumnIndex) {
    return { rowspan: 0, colspan: 0 }
  }

  return {
    rowspan: Math.min(merge.endRow, PREVIEW_ROW_COUNT - 1) - merge.startRow + 1,
    colspan:
      Math.min(merge.endColumn, previewColumnIndexes.value.length - 1) - merge.startColumn + 1
  }
}

/** 为合并单元格添加样式标记 */
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
