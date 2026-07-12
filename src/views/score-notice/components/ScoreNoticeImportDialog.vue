<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'
import { ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import { buildScoreNoticeImport, recalculateNoticeGrades } from '@/utils/scoreNoticeImportUntil'
import {
  DEFAULT_100_SCORE_RULE,
  DEFAULT_50_SCORE_RULE,
  detectScoreNoticeMode,
  getDefaultGradeRule
} from '@/utils/scoreNoticeGradeUntil'
import { buildExcelDataFromHeaderRow, parseExcelPreview } from '@/utils/xlsxUntil'

import type { UploadFile, UploadFiles, UploadInstance } from 'element-plus'
import type { ScoreNoticeGradeRuleType, ScoreNoticeImportResultType } from '@/types/ScoreNotice'
import type { ExcelPreviewResultType } from '@/utils/xlsxUntil'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  modelValue: boolean
  systemStudents: StudentDataType[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [result: ScoreNoticeImportResultType, fileName: string]
}>()

const preview = ref<ExcelPreviewResultType | null>(null)
const fileName = ref('')
const loading = ref(false)
const headerRowIndex = ref(0)
const nameColumn = ref('')
const subjectColumns = ref<string[]>([])
const sourceMode = ref(ScoreNoticeModeEnum.Grade)
const modeTouched = ref(false)
const rules = ref<Record<string, ScoreNoticeGradeRuleType>>({})
const uploadRef = ref<UploadInstance>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const parsedData = computed(() => {
  if (!preview.value) return { header: [], data: [] }
  return buildExcelDataFromHeaderRow(preview.value.rows, headerRowIndex.value)
})

const availableSubjects = computed(() =>
  parsedData.value.header.filter(
    (header) => header !== nameColumn.value && header !== '序号' && !header.startsWith('UNKNOWN')
  )
)

const resetSelections = (): void => {
  const headers = parsedData.value.header
  nameColumn.value =
    headers.find((header) =>
      ['姓名', '学生姓名', '学生', '名字'].some((item) => header.includes(item))
    ) || ''
  subjectColumns.value = headers.filter(
    (header) => header !== nameColumn.value && header !== '序号' && !header.startsWith('UNKNOWN')
  )
  rules.value = subjectColumns.value.reduce<Record<string, ScoreNoticeGradeRuleType>>(
    (result, column) => {
      result[column] = getDefaultGradeRule(column)
      return result
    },
    {}
  )
  modeTouched.value = false
}

const resetDialog = (): void => {
  uploadRef.value?.clearFiles()
  preview.value = null
  fileName.value = ''
  headerRowIndex.value = 0
  nameColumn.value = ''
  subjectColumns.value = []
  sourceMode.value = ScoreNoticeModeEnum.Grade
  rules.value = {}
  modeTouched.value = false
}

const handleFileChange = async (file: UploadFile, files: UploadFiles): Promise<void> => {
  void files
  if (!file.raw) return
  loading.value = true
  try {
    preview.value = await parseExcelPreview(file)
    fileName.value = file.name
    headerRowIndex.value = preview.value.suggestedHeaderRowIndex
    resetSelections()
  } catch (error) {
    console.error('读取成绩通知 Excel 失败:', error)
    ElMessage.error('Excel 读取失败，请检查文件格式')
  } finally {
    loading.value = false
  }
}

const handleModeChange = (value: string | number | boolean | undefined): void => {
  if (value === ScoreNoticeModeEnum.Grade || value === ScoreNoticeModeEnum.Score) {
    sourceMode.value = value
    modeTouched.value = true
  }
}

const applyRuleTemplate = (column: string, template: string): void => {
  if (template === '100') rules.value[column] = { ...DEFAULT_100_SCORE_RULE }
  if (template === '50') rules.value[column] = { ...DEFAULT_50_SCORE_RULE }
}

const getRuleTemplate = (column: string): string => {
  const rule = rules.value[column]
  if (!rule) return 'custom'
  if (rule.maxScore === 100 && rule.gradeAMin === 80 && rule.gradeBMin === 60) return '100'
  if (rule.maxScore === 50 && rule.gradeAMin === 40 && rule.gradeBMin === 30) return '50'
  return 'custom'
}

const handleConfirm = (): void => {
  if (!preview.value || !fileName.value) {
    ElMessage.warning('请先选择 Excel 文件')
    return
  }
  if (!nameColumn.value) {
    ElMessage.warning('请选择姓名列')
    return
  }
  if (!subjectColumns.value.length) {
    ElMessage.warning('请至少选择一个科目列')
    return
  }
  if (
    sourceMode.value === ScoreNoticeModeEnum.Score &&
    subjectColumns.value.some((column) => {
      const rule = rules.value[column]
      return !rule || rule.gradeBMin >= rule.gradeAMin || rule.gradeAMin > rule.maxScore
    })
  ) {
    ElMessage.warning('请检查分数换算规则，需满足 B线 < A线 ≤ 满分')
    return
  }

  const result = buildScoreNoticeImport({
    rows: parsedData.value.data,
    nameColumn: nameColumn.value,
    subjectColumns: subjectColumns.value,
    requestedMode: sourceMode.value,
    systemStudents: props.systemStudents
  })
  if (sourceMode.value === ScoreNoticeModeEnum.Score) {
    result.subjects = result.subjects.map((subject) => ({
      ...subject,
      rule: { ...(rules.value[subject.label] || subject.rule) }
    }))
    result.students = recalculateNoticeGrades({
      subjects: result.subjects,
      students: result.students
    })
  }
  emit('confirm', result, fileName.value)
  visible.value = false
}

watch(headerRowIndex, () => {
  if (preview.value) resetSelections()
})

watch(subjectColumns, (columns) => {
  columns.forEach((column) => {
    if (!rules.value[column]) rules.value[column] = getDefaultGradeRule(column)
  })
  if (modeTouched.value) return
  const values = columns.flatMap((column) =>
    parsedData.value.data.slice(0, 20).map((row) => row[column])
  )
  sourceMode.value = detectScoreNoticeMode(values)
})

watch(
  () => props.modelValue,
  (value) => {
    if (value) void nextTick(resetDialog)
  }
)
</script>

<template>
  <el-dialog v-model="visible" title="导入考试成绩" width="920px" :close-on-click-modal="false">
    <div v-loading="loading" class="notice-import">
      <el-upload
        ref="uploadRef"
        class="notice-import__upload"
        drag
        accept=".xlsx,.xls"
        :auto-upload="false"
        :limit="1"
        :on-change="handleFileChange"
      >
        <font-awesome-icon :icon="['solid', 'file-excel']" />
        <div>
          <strong>{{ fileName || '选择或拖入 Excel 文件' }}</strong>
          <span>支持已有等级或具体分数，导入后可继续确认列和换算规则</span>
        </div>
      </el-upload>

      <template v-if="preview">
        <excel-header-row-picker
          v-model="headerRowIndex"
          :rows="preview.rows"
          :merges="preview.merges"
        />

        <section class="notice-import__section">
          <div class="notice-import__section-head">
            <strong>姓名列</strong><span>选择用于识别学生的列</span>
          </div>
          <el-radio-group v-model="nameColumn" class="notice-import__options">
            <el-radio-button v-for="header in parsedData.header" :key="header" :value="header">
              {{ header }}
            </el-radio-button>
          </el-radio-group>
        </section>

        <section class="notice-import__section">
          <div class="notice-import__section-head">
            <strong>科目列</strong><span>科目不固定，可按当前考试自由选择</span>
          </div>
          <el-checkbox-group v-model="subjectColumns" class="notice-import__options">
            <el-checkbox-button v-for="header in availableSubjects" :key="header" :value="header">
              {{ header }}
            </el-checkbox-button>
          </el-checkbox-group>
        </section>

        <section class="notice-import__section notice-import__section--mode">
          <div class="notice-import__section-head">
            <strong>Excel 内容类型</strong><span>系统已自动判断，可手动修正</span>
          </div>
          <el-segmented
            :model-value="sourceMode"
            :options="[
              { label: '等级', value: ScoreNoticeModeEnum.Grade },
              { label: '分数', value: ScoreNoticeModeEnum.Score }
            ]"
            @change="handleModeChange"
          />
        </section>

        <section
          v-if="sourceMode === ScoreNoticeModeEnum.Score"
          class="notice-import__section notice-import__rules"
        >
          <div class="notice-import__section-head">
            <strong>等级换算规则</strong><span>每个科目均可独立配置</span>
          </div>
          <div class="notice-import__rule-head">
            <span>科目</span><span>模板</span><span>满分</span><span>A等起点</span
            ><span>B等起点</span>
          </div>
          <div v-for="column in subjectColumns" :key="column" class="notice-import__rule-row">
            <strong>{{ column }}</strong>
            <el-select
              :model-value="getRuleTemplate(column)"
              @change="(value: string) => applyRuleTemplate(column, value)"
            >
              <el-option label="100分制" value="100" />
              <el-option label="50分制" value="50" />
              <el-option label="自定义" value="custom" />
            </el-select>
            <el-input-number
              v-model="rules[column].maxScore"
              :min="1"
              :max="1000"
              controls-position="right"
            />
            <el-input-number
              v-model="rules[column].gradeAMin"
              :min="0"
              :max="1000"
              controls-position="right"
            />
            <el-input-number
              v-model="rules[column].gradeBMin"
              :min="0"
              :max="1000"
              controls-position="right"
            />
          </div>
        </section>
      </template>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!preview" @click="handleConfirm">确认导入</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.notice-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.notice-import__upload {
  :deep(.el-upload-dragger) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    height: 92px;
    padding: 14px;
    background: #f8fbfb;
    border-color: #a8ceca;
  }
  svg {
    color: var(--el-color-primary);
    font-size: 34px;
  }
  strong,
  span {
    display: block;
    text-align: left;
  }
  strong {
    color: #234441;
    font-size: 15px;
  }
  span {
    margin-top: 5px;
    color: #71807f;
    font-size: 12px;
  }
}
.notice-import__section {
  padding: 13px 15px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.notice-import__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.notice-import__section-head strong {
  color: #263f3d;
  font-size: 14px;
}
.notice-import__section-head span {
  color: #718096;
  font-size: 12px;
}
.notice-import__options {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 2px 1px 7px;

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

  :deep(.el-radio-button:not(.is-active) .el-radio-button__inner:hover),
  :deep(.el-checkbox-button:not(.is-checked) .el-checkbox-button__inner:hover) {
    color: var(--theme-primary) !important;
    border-color: var(--theme-primary) !important;
  }
}
.notice-import__section--mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.notice-import__section--mode .notice-import__section-head {
  display: block;
  margin: 0;
}
.notice-import__rule-head,
.notice-import__rule-row {
  display: grid;
  grid-template-columns: 1.1fr 1.2fr repeat(3, 1fr);
  align-items: center;
  gap: 9px;
}
.notice-import__rule-head {
  margin-bottom: 7px;
  color: #718096;
  font-size: 12px;
}
.notice-import__rule-row {
  padding: 7px 0;
  border-top: 1px solid #e4eceb;
}
.notice-import__rule-row strong {
  color: #304c49;
  font-size: 13px;
}
.notice-import__rule-row :deep(.el-input-number) {
  width: 100%;
}
</style>
