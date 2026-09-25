<script setup lang="ts">
/**
 * AI 识图成绩预览对话框
 * 展示按姓名匹配后的识别结果，供用户勾选并写入有效成绩。
 */
import { computed, ref, watch } from 'vue'

import { isValidScore } from '@/utils/scoreRecognitionUtil'
import type { ScoreRecognitionPreviewRowType } from '@/utils/scoreRecognitionUtil'

interface Props {
  /** 弹窗显隐状态（双向绑定） */
  visible: boolean
  /** AI 识别的成绩预览行数据 */
  rows: ScoreRecognitionPreviewRowType[]
  /** 识别到但不在启用名册中的姓名 */
  ignoredNames: string[]
  /** 当前成绩列满分 */
  fullMark: number
}

const props = defineProps<Props>()

/** 对话框事件：控制显隐、提交勾选结果 */
const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [rows: ScoreRecognitionPreviewRowType[]]
}>()

const tableData = ref<ScoreRecognitionPreviewRowType[]>([])
const selectedStudentIds = ref<string[]>([])
const matchedCount = computed(() => tableData.value.filter((row) => row.source === 'matched').length)
const suggestedCount = computed(() => tableData.value.filter((row) => row.source === 'suggested').length)
const missingCount = computed(() => tableData.value.filter((row) => row.source === 'missing').length)
const suggestedNames = computed(() =>
  tableData.value
    .filter((row) => row.source === 'suggested')
    .map((row) => `${row.name}（图片：${row.rawName || '无法辨认'}）`)
    .join('、')
)
const missingNames = computed(() =>
  tableData.value.filter((row) => row.source === 'missing').map((row) => row.name).join('、')
)

/**
 * 计算名册行的展示状态（未识别 / 分数无效 / 无分数 / 将覆盖 / 正常）。
 * @param row 识别预览行
 * @returns 状态文案与标签类型
 */
const getStatus = (row: ScoreRecognitionPreviewRowType) => {
  if (row.source === 'missing' && row.score === null)
    return { text: '未识别', type: 'warning' as const }
  if (!row.valid) return { text: '分数无效', type: 'danger' as const }
  if (row.score === null) return { text: '无分数', type: 'info' as const }
  if (row.source === 'suggested') return { text: '待核对', type: 'warning' as const }
  if (row.willOverwrite) return { text: '将覆盖', type: 'warning' as const }
  if (row.source === 'missing') return { text: '手动补录', type: 'success' as const }
  return { text: '正常', type: 'success' as const }
}

/** 编辑成绩后重新校验；补录行仍需用户主动勾选。 */
const updateScore = (row: ScoreRecognitionPreviewRowType): void => {
  row.valid = isValidScore(row.score, props.fullMark)
  row.willOverwrite = row.existingScore !== null && row.existingScore !== row.score
  if (!row.valid) {
    selectedStudentIds.value = selectedStudentIds.value.filter((id) => id !== row.studentId)
  }
}

/** 单行复选框使用布尔值，选中的学生 ID 仍统一保存在数组中。 */
const setSelected = (studentId: string, checked: boolean): void => {
  if (!checked) {
    selectedStudentIds.value = selectedStudentIds.value.filter((id) => id !== studentId)
    return
  }
  const row = tableData.value.find((item) => item.studentId === studentId)
  if (!row?.valid || row.score === null) return
  if (!selectedStudentIds.value.includes(studentId)) {
    selectedStudentIds.value = [...selectedStudentIds.value, studentId]
  }
}

/** 分数展示格式化，无分数时显示“-” */
const formatScore = (score: number | null) => (score === null ? '-' : String(score))

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    tableData.value = props.rows.map((row) => ({ ...row }))
    selectedStudentIds.value = tableData.value
      .filter((row) => row.source === 'matched' && row.valid)
      .map((row) => row.studentId)
  }
)

/** 关闭对话框 */
const closeDialog = () => {
  emit('update:visible', false)
}

/** 提交已勾选的有效识别结果并关闭对话框 */
const handleConfirm = () => {
  const selected = tableData.value.filter(
    (row) => selectedStudentIds.value.includes(row.studentId) && row.valid && row.score !== null
  )
  emit('confirm', selected)
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="确认 AI 识别的成绩"
    width="760px"
    :close-on-click-modal="false"
    @update:model-value="(value: boolean) => !value && closeDialog()"
  >
    <div class="score-recognition-preview">
      <div class="score-recognition-preview__tip">
        名册 {{ props.rows.length }} 人：一一对应 {{ matchedCount }} 人，建议核对
        {{ suggestedCount }} 人，未识别 {{ missingCount }} 人。分数有效且一一对应的行已默认勾选。
      </div>
      <el-alert
        v-if="suggestedCount || missingCount || ignoredNames.length"
        type="warning"
        :closable="false"
        show-icon
        class="score-recognition-preview__warning"
      >
        <template #title>以下识别结果需要核对</template>
        <div v-if="suggestedCount">模型未确认姓名对应或建议姓名与图片原文不同，默认不勾选：{{ suggestedNames }}</div>
        <div v-if="missingCount">名册中未对应：{{ missingNames }}</div>
        <div v-if="ignoredNames.length">已忽略名单外识别结果：{{ ignoredNames.join('、') }}</div>
        <div v-if="missingCount">可补录分数，再手动勾选写入。</div>
      </el-alert>

      <el-table :data="tableData" max-height="500" border>
        <el-table-column label="写入" width="58" align="center">
          <template #default="{ row }">
            <el-checkbox
              :model-value="selectedStudentIds.includes(row.studentId)"
              :disabled="!row.valid || row.score === null"
              @update:model-value="(value) => setSelected(row.studentId, value === true)"
            ><span class="sr-only">写入 {{ row.name }}</span></el-checkbox>
          </template>
        </el-table-column>
        <el-table-column label="姓名" prop="name" min-width="110" />
        <el-table-column label="图片原姓名" min-width="110">
          <template #default="{ row }">{{ row.rawName || '-' }}</template>
        </el-table-column>
        <el-table-column label="识别／补录分数" min-width="150">
          <template #default="{ row }">
            <el-input-number
              v-model="row.score"
              :controls="false"
              :value-on-clear="null"
              placeholder="填写分数"
              class="score-recognition-preview__input"
              @change="() => updateScore(row)"
            />
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

    <!-- 底部操作：取消 / 确认写入 -->
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

.score-recognition-preview__input {
  width: 100%;
}
</style>
