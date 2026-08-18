<script setup lang="ts">
/**
 * AI 识图成绩预览对话框
 * 展示按姓名匹配后的识别结果，供用户勾选并写入有效成绩。
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { ElTable } from 'element-plus'

import type { ScoreRecognitionPreviewRowType } from '@/utils/scoreRecognitionUtil'

interface Props {
  visible: boolean
  rows: ScoreRecognitionPreviewRowType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [rows: ScoreRecognitionPreviewRowType[]]
}>()

const tableRef = ref<InstanceType<typeof ElTable>>()

/** 为表格多选提供唯一 row-key */
const tableData = computed(() =>
  props.rows.map((row, index) => ({ ...row, _rowKey: String(index) }))
)

/**
 * 计算识别行的展示状态（未匹配 / 分数无效 / 无分数 / 将覆盖 / 正常）。
 * @param row 识别预览行
 * @returns 状态文案与标签类型
 */
const getStatus = (row: ScoreRecognitionPreviewRowType) => {
  if (!row.matched) return { text: '未匹配', type: 'danger' as const }
  if (!row.valid) return { text: '分数无效', type: 'danger' as const }
  if (row.score === null) return { text: '无分数', type: 'info' as const }
  if (row.willOverwrite) return { text: '将覆盖', type: 'warning' as const }
  return { text: '正常', type: 'success' as const }
}

/** 判断行是否允许被勾选写入 */
const getSelectable = (row: ScoreRecognitionPreviewRowType) =>
  row.matched && row.valid && row.score !== null

/** 分数展示格式化，无分数时显示“-” */
const formatScore = (score: number | null) => (score === null ? '-' : String(score))

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    // 对话框打开后默认勾选所有可写入行
    nextTick(() => {
      tableData.value.forEach((row) => {
        if (getSelectable(row)) {
          tableRef.value?.toggleRowSelection(row, true)
        }
      })
    })
  }
)

/** 关闭对话框 */
const closeDialog = () => {
  emit('update:visible', false)
}

/** 提交已勾选的有效识别结果并关闭对话框 */
const handleConfirm = () => {
  const selected = (tableRef.value?.getSelectionRows() ?? []) as ScoreRecognitionPreviewRowType[]
  emit('confirm', selected)
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="确认 AI 识别的成绩"
    width="640px"
    :close-on-click-modal="false"
    @update:model-value="(value: boolean) => !value && closeDialog()"
  >
    <div class="score-recognition-preview">
      <div class="score-recognition-preview__tip">
        已按姓名匹配学生，请勾选需要写入的成绩。未匹配或分数无效的行默认不写入。
      </div>

      <el-table
        ref="tableRef"
        :data="tableData"
        row-key="_rowKey"
        max-height="400"
        border
        @selection-change="() => {}"
      >
        <el-table-column type="selection" width="48" :selectable="getSelectable" />
        <el-table-column label="姓名" prop="name" min-width="90" />
        <el-table-column label="识别分数" width="90">
          <template #default="{ row }">
            <span :class="{ 'is-invalid': !row.valid }">{{ formatScore(row.score) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="当前分数" width="90">
          <template #default="{ row }">{{ formatScore(row.existingScore) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="getStatus(row).type" size="small">{{ getStatus(row).text }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确认写入</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.score-recognition-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-recognition-preview__tip {
  padding: 10px 12px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 13px;
}

.is-invalid {
  color: #f56c6c;
}
</style>
