<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import { ElLoading, ElMessage } from 'element-plus'

import StudentReportExportSidebar from '@/components/student-report/StudentReportExportSidebar.vue'
import StudentReportPreviewCard from '@/components/student-report/StudentReportPreviewCard.vue'
import { generateStudentReportSummary } from '@/ai/aiService'
import { useAIConfigStore } from '@/stores/ai-config'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import {
  buildStudentReportData,
  buildStudentReportTemplateText,
  exportStudentReportImage
} from '@/utils/studentReportUntil'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  visible: boolean
  student: StudentDataType | null
  scoreColumns: SettingType[]
}

type ContentStatusType = 'idle' | 'ready' | 'dirty' | 'stale'
type ExportQualityType = 'standard' | 'high' | 'ultra'

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const dataStore = useDataSourceStore()
const settingStore = useSettingStore()
const aiConfigStore = useAIConfigStore()
const { enabledData } = storeToRefs(dataStore)
const { tagCategories } = storeToRefs(settingStore)

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const selectedProps = ref<string[]>([])
const content = ref('')
const generating = ref(false)
const exporting = ref(false)
const fullscreen = ref(false)
const previewRef = ref<HTMLElement | null>(null)
const contentStatus = ref<ContentStatusType>('idle')
const exportQuality = ref<ExportQualityType>('high')
const exportScale = ref('2')

const report = computed(() => {
  if (!props.student) return null
  return buildStudentReportData({
    student: props.student,
    students: enabledData.value,
    scoreColumns: props.scoreColumns,
    selectedProps: selectedProps.value,
    tagCategories: tagCategories.value,
    classLabel: '本班'
  })
})

const selectedCount = computed(() => selectedProps.value.length)
const hasContent = computed(() => Boolean(content.value.trim()))
const canExport = computed(() => {
  return selectedCount.value > 0 && hasContent.value && !generating.value && !exporting.value
})
const generatorLabel = computed(() => (aiConfigStore.isConfigured ? '可选 AI 生成' : '模板内容'))
const previewContent = computed(() => {
  if (content.value.trim()) return content.value
  if (!report.value) return ''
  return buildStudentReportTemplateText(report.value)
})

/**
 * 每次打开弹窗时默认选中全部成绩项，保证预览和导出状态可预测。
 */
const syncDefaultSelection = (): void => {
  selectedProps.value = props.scoreColumns.map((item) => item.prop)
}

const applyTemplateContent = (): void => {
  if (!report.value) return
  content.value = buildStudentReportTemplateText(report.value)
  contentStatus.value = 'ready'
}

const generateContent = async (): Promise<void> => {
  if (!report.value || !selectedCount.value) return

  if (!aiConfigStore.isConfigured) {
    applyTemplateContent()
    return
  }

  generating.value = true
  try {
    const nextContent = await generateStudentReportSummary(
      {
        name: report.value.studentName,
        tags: report.value.tags,
        score: report.value.scoreItems.map((item) => ({
          label: item.label,
          value: item.score
        }))
      },
      {
        modelType: aiConfigStore.modelType,
        model: aiConfigStore.model,
        apiKey: aiConfigStore.apiKey,
        baseUrl: aiConfigStore.baseUrl
      }
    )

    content.value = nextContent.trim() || buildStudentReportTemplateText(report.value)
    contentStatus.value = 'ready'
  } catch (error) {
    console.error('生成学习报告正文失败:', error)
    applyTemplateContent()
    ElMessage.warning('AI 生成失败，已切换为模板内容')
  } finally {
    generating.value = false
  }
}

const handleOpen = async (): Promise<void> => {
  syncDefaultSelection()
  fullscreen.value = false
  exportQuality.value = 'high'
  exportScale.value = '2'
  await nextTick()
  applyTemplateContent()
}

/**
 * 质量档位只负责微调最终倍率，基础倍率仍由用户显式控制。
 */
const resolveExportScale = (): number => {
  const qualityMap: Record<ExportQualityType, number> = {
    standard: 1,
    high: 1.2,
    ultra: 1.5
  }

  const baseScale = Number(exportScale.value) || 2
  return Number((baseScale * qualityMap[exportQuality.value]).toFixed(1))
}

const handleContentInput = (value: string): void => {
  content.value = value
  contentStatus.value = value.trim() ? 'dirty' : 'stale'
}

const handleSelectedPropsUpdate = (value: string[]): void => {
  selectedProps.value = value
}

const handleExportQualityUpdate = (value: string): void => {
  if (value === 'standard' || value === 'high' || value === 'ultra') {
    exportQuality.value = value
  }
}

const handleExportScaleUpdate = (value: string): void => {
  exportScale.value = value
}

const toggleFullscreen = (): void => {
  fullscreen.value = !fullscreen.value
}

const closeDialog = (): void => {
  dialogVisible.value = false
}

const handleExport = async (): Promise<void> => {
  if (!report.value) return
  if (!canExport.value) {
    ElMessage.warning('请先选择成绩并生成正文内容')
    return
  }

  if (!previewRef.value) return

  exporting.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出学习报告图片...'
  })

  try {
    await nextTick()
    const result = await exportStudentReportImage(
      previewRef.value,
      `${report.value.studentName}-学习报告.png`,
      {
        scale: resolveExportScale(),
        backgroundColor: '#F9F4EB'
      }
    )

    if (!result.success) {
      ElMessage.error(result.error?.message || '导出失败')
      return
    }

    ElMessage.success('学习报告导出成功')
    dialogVisible.value = false
  } finally {
    exporting.value = false
    loading.close()
  }
}

watch(
  () => props.visible,
  async (value) => {
    if (value && props.student) {
      await handleOpen()
    }
  }
)

watch(selectedProps, (value, oldValue) => {
  if (!props.visible || !oldValue) return
  if (value.join('|') === oldValue.join('|')) return

  // 成绩范围变化后，旧正文已经不再可靠，强制重新生成。
  content.value = ''
  contentStatus.value = value.length ? 'stale' : 'idle'
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="导出学习报告"
    :class="[
      'student-report-export-modal',
      { 'student-report-export-modal--fullscreen': fullscreen }
    ]"
    :modal-class="
      fullscreen
        ? 'student-report-export-overlay student-report-export-overlay--fullscreen'
        : 'student-report-export-overlay'
    "
    body-class="student-report-export-modal__body"
    :fullscreen="fullscreen"
    :width="fullscreen ? undefined : '1460px'"
    top="0"
    :close-on-click-modal="false"
    :show-close="false"
    destroy-on-close
  >
    <template #header>
      <div class="student-report-export-dialog__header">
        <span class="student-report-export-dialog__title">导出学习报告</span>
        <div class="student-report-export-dialog__actions">
          <el-tooltip :content="fullscreen ? '退出全屏' : '全屏查看'" placement="bottom">
            <button
              class="student-report-export-dialog__icon-button"
              type="button"
              :aria-label="fullscreen ? '退出全屏' : '全屏查看'"
              @click="toggleFullscreen"
            >
              <font-awesome-icon
                :icon="[
                  'fas',
                  fullscreen
                    ? 'down-left-and-up-right-to-center'
                    : 'up-right-and-down-left-from-center'
                ]"
              />
            </button>
          </el-tooltip>
          <el-tooltip content="关闭" placement="bottom">
            <button
              class="student-report-export-dialog__icon-button"
              type="button"
              aria-label="关闭"
              @click="closeDialog"
            >
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div v-if="report" class="student-report-export-dialog">
      <el-scrollbar class="student-report-export-dialog__sidebar-scrollbar">
        <div class="student-report-export-dialog__sidebar">
          <student-report-export-sidebar
            :score-columns="scoreColumns"
            :selected-props="selectedProps"
            :content="content"
            :content-status="contentStatus"
            :generating="generating"
            :exporting="exporting"
            :can-export="canExport"
            :generator-label="generatorLabel"
            :ai-configured="aiConfigStore.isConfigured"
            :export-quality="exportQuality"
            :export-scale="exportScale"
            @update:selected-props="handleSelectedPropsUpdate"
            @update:content="handleContentInput"
            @update:export-quality="handleExportQualityUpdate"
            @update:export-scale="handleExportScaleUpdate"
            @apply-template-content="applyTemplateContent"
            @generate-content="generateContent"
            @export="handleExport"
          />
        </div>
      </el-scrollbar>

      <div class="student-report-export-dialog__preview">
        <el-scrollbar class="student-report-export-dialog__preview-scrollbar">
          <div class="student-report-export-dialog__preview-shell">
            <div ref="previewRef" class="student-report-export-dialog__preview-card">
              <student-report-preview-card :report="report" :content="previewContent" />
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.student-report-export-dialog {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
  width: 100%;
  height: 100%;
  min-height: 0;
  align-items: stretch;
}

.student-report-export-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.student-report-export-dialog__title {
  color: #1f2937;
  font-size: 16px;
  font-weight: 700;
}

.student-report-export-dialog__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.student-report-export-dialog__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: #566174;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 50%;
  background: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.student-report-export-dialog__icon-button:hover {
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.42);
  background: #eff6ff;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12);
}

.student-report-export-dialog__icon-button:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.36);
  outline-offset: 2px;
}

.student-report-export-dialog__sidebar-scrollbar,
.student-report-export-dialog__preview {
  min-height: 0;
}

.student-report-export-dialog__sidebar-scrollbar {
  height: 100%;
  min-width: 0;
}

.student-report-export-dialog__sidebar {
  min-height: 100%;
  padding: 6px 4px 6px 0;
}

.student-report-export-dialog__preview {
  min-height: 0;
  min-width: 0;
}

.student-report-export-dialog__preview-scrollbar {
  height: 100%;
}

.student-report-export-dialog__preview-shell {
  display: flex;
  justify-content: center;
  min-height: 100%;
  min-width: 100%;
  width: max-content;
  padding: 18px;
  box-sizing: border-box;
  border: 1px solid rgba(220, 228, 237, 0.92);
  background:
    radial-gradient(circle at 12% 16%, rgba(59, 130, 246, 0.08), transparent 18%),
    radial-gradient(circle at 88% 12%, rgba(249, 115, 22, 0.08), transparent 16%),
    linear-gradient(180deg, #eef2f7 0%, #e7edf4 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.student-report-export-dialog__preview-card {
  flex: 0 0 auto;
}

:global(.student-report-export-modal) {
  margin-bottom: 0;
}

:global(.student-report-export-overlay) {
  overflow: hidden !important;
}

:global(.student-report-export-overlay .el-overlay-dialog) {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 0;
  overflow: hidden !important;
}

:global(.student-report-export-overlay--fullscreen .el-overlay-dialog) {
  align-items: stretch;
  padding: 0;
}

:global(.student-report-export-modal.el-dialog) {
  display: flex;
  flex-direction: column;
  height: min(calc(100vh - 48px), 940px);
  max-height: calc(100vh - 48px);
  margin: 0;
  overflow: hidden !important;
}

:global(.student-report-export-modal.el-dialog.is-fullscreen),
:global(.student-report-export-modal.el-dialog.student-report-export-modal--fullscreen) {
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  max-height: 100vh;
  min-height: 100vh;
  margin: 0;
  top: 0;
  border-radius: 0;
}

:global(.student-report-export-modal__body) {
  flex: 1;
  display: flex;
  min-height: 0;
  padding-top: 8px;
  overflow: hidden !important;
}

.student-report-export-dialog__sidebar-scrollbar :deep(.el-scrollbar__wrap),
.student-report-export-dialog__preview-scrollbar :deep(.el-scrollbar__wrap) {
  height: 100%;
}

.student-report-export-dialog__sidebar-scrollbar :deep(.el-scrollbar__view),
.student-report-export-dialog__preview-scrollbar :deep(.el-scrollbar__view) {
  min-height: 100%;
}

@media (max-width: 1600px) {
  .student-report-export-dialog {
    grid-template-columns: 300px minmax(0, 1fr);
  }
}

@media (max-width: 1200px) {
  .student-report-export-dialog {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
}
</style>
