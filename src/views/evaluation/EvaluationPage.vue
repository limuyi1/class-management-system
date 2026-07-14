<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

import CommentExcelImportDialog from '@/views/evaluation/components/CommentExcelImportDialog.vue'
import CommentWorkspaceToolbar from '@/views/evaluation/components/CommentWorkspaceToolbar.vue'
import EvaluationTableView from '@/views/evaluation/components/EvaluationTableView.vue'
import ToolPanelView from '@/views/evaluation/components/ToolPanelView.vue'
import { useProgress } from '@/hooks/useProgress'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { useEvaluationBatchComments } from '@/views/evaluation/composables/useEvaluationBatchComments'
import { useEvaluationHandwriteFont } from '@/views/evaluation/composables/useEvaluationHandwriteFont'
import { useEvaluationTextPdfExport } from '@/views/evaluation/composables/useEvaluationTextPdfExport'
import { useEvaluationCommentSource } from '@/views/evaluation/composables/useEvaluationCommentSource'
import type { PreviewModeType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

/**
 * 期末评语管理页面
 * 展示学生期末评语列表，提供编辑、AI 生成和 PDF 导出功能
 */

const evaluationTableViewRef = ref<InstanceType<typeof EvaluationTableView>>()
const toolPanelViewRef = ref<InstanceType<typeof ToolPanelView>>()
const fontFileInputRef = ref<HTMLInputElement | null>(null)
const route = useRoute()
const router = useRouter()

const backToTools = (): void => {
  void router.push('/tools')
}

const dataStore = useDataSourceStore()
const { enabledData: systemStudents } = storeToRefs(dataStore)
const configuration = useConfigurationStore()
const settingStore = useSettingStore()
const { tagCategories: tagCategoryList } = storeToRefs(settingStore)
const aiConfigStore = useAIConfigStore()
const {
  allowTagEditing,
  excelExporting,
  excelFileName,
  excelStudentCount,
  handleExcelExport,
  handleExcelImport,
  handleSourceChange,
  handleUploadRequest,
  importDialogVisible,
  source,
  students,
  tagCategories
} = useEvaluationCommentSource({
  systemStudents,
  systemTagCategories: tagCategoryList
})
const { percentage, notCompletedCount } = useProgress({
  data: students,
  getValue: (item: StudentDataType) => item.comment
})
const totalCount = computed(() => students.value.length)
const hasWorkspaceData = computed(() => totalCount.value > 0)
const completedCount = computed(() => Math.max(0, totalCount.value - notCompletedCount.value))
const activeStudentId = ref('')
const normalizePreviewMode = (value: string): PreviewModeType => {
  if (value === 'fit' || value === '50' || value === '75' || value === '100' || value === '125') {
    return value
  }

  return value === 'actual' ? '100' : '100'
}

const previewMode = computed<PreviewModeType>({
  get: () => normalizePreviewMode(configuration.previewMode),
  set: (value) => {
    configuration.previewMode = value
  }
})

const { batchGenerating, batchPolishing, handleBatchGenerate, handleBatchPolish } =
  useEvaluationBatchComments({
    students,
    tagCategoryList: tagCategories,
    aiConfig: aiConfigStore
  })
const {
  displayHandwriteFontName,
  handwriteFontApplying,
  handleChooseHandwriteFont,
  handleClearHandwriteFont,
  handleHandwriteFontChange,
  initializeHandwriteFont,
  savedHandwriteFontName,
  showDefaultFontSlowNotice
} = useEvaluationHandwriteFont({
  configuration,
  fontFileInputRef
})
const { handleExportTextExcel, handleExportTextPDF, textExcelExporting, textPdfExporting } =
  useEvaluationTextPdfExport({
    enabledStudents: students,
    configuration
  })
const textExporting = computed(
  () => textPdfExporting.value || textExcelExporting.value || excelExporting.value
)
const batchProcessing = computed(() => batchGenerating.value || batchPolishing.value)

/**
 * 自动聚焦到工具面板
 */
const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

const handleExportAction = (command: string | number | object) => {
  if (command === 'pdf') {
    void handleExportTextPDF()
    return
  }

  if (command === 'excel') {
    if (source.value === 'excel') {
      void handleExcelExport()
    } else {
      void handleExportTextExcel()
    }
  }
}

const handleBatchAction = async (command: string | number | object): Promise<void> => {
  if (command === 'fill-empty') {
    await handleBatchGenerate('skip')
    return
  }

  if (command === 'overwrite') {
    try {
      await ElMessageBox.confirm(
        `将重新生成并覆盖当前 ${students.value.length} 名学生的评语，是否继续？`,
        '确认重新生成',
        {
          confirmButtonText: '覆盖并生成',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      await handleBatchGenerate('overwrite')
    } catch {
      // 用户取消覆盖时保持现有评语。
    }
    return
  }

  if (command === 'polish') await handleBatchPolish()
}

onMounted(() => {
  void initializeHandwriteFont()
})

/**
 * 处理评语卡片点击事件
 * 点击左侧学生期末评语卡片时，激活右侧输入区进行编辑
 * @param row - 被点击的学生行数据
 */
const handleCardClick = (row: StudentDataType) => {
  toolPanelViewRef.value?.fillStudentData(row)
}

const handleActiveStudentChange = (row: StudentDataType | null) => {
  activeStudentId.value = row?.studentId || ''
}

const handleResetComments = async () => {
  const existingCount = students.value.filter((item) => item.comment && item.comment.trim()).length

  if (existingCount === 0) {
    ElMessage.info('当前没有可清空的评语')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要清空全部 ${existingCount} 条已填写评语吗？此操作不可恢复。`,
      '重置评语',
      {
        confirmButtonText: '清空评语',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    students.value.forEach((item) => {
      item.comment = undefined
    })
    toolPanelViewRef.value?.resetForm()
    ElMessage.success('已清空所有评语')
  } catch {
    // 用户取消操作时不提示
  }
}

const resumeEditingStudent = async (studentId: string) => {
  await nextTick()
  const student = dataStore.getStudentById(studentId)
  if (!student || !toolPanelViewRef.value) return false

  toolPanelViewRef.value.fillStudentData(student)
  return true
}

watch(
  () => [route.query['resume-edit'], route.query['student-id'], !!toolPanelViewRef.value] as const,
  async ([resumeEdit, studentId, ready]) => {
    if (resumeEdit !== '1' || typeof studentId !== 'string' || !studentId || !ready) return

    const resumed = await resumeEditingStudent(studentId)
    if (resumed) {
      await router.replace({ path: '/tools/comments' })
    }
  },
  { immediate: true }
)

watch(source, async () => {
  activeStudentId.value = ''
  await nextTick()
  toolPanelViewRef.value?.resetForm()
})

defineExpose({ autoFocus })
</script>

<template>
  <div class="evaluation-page app-page-shell">
    <page-header
      class="evaluation-page-header"
      :icon="['solid', 'comments']"
      title="评语处理"
      subtitle="使用系统学生或 Excel 临时数据生成、润色和导出评语"
    >
      <template #left>
        <el-tooltip content="返回工具" placement="top">
          <el-button size="small" circle aria-label="返回工具" @click="backToTools">
            <font-awesome-icon :icon="['solid', 'arrow-left']" />
          </el-button>
        </el-tooltip>
      </template>
    </page-header>

    <input
      ref="fontFileInputRef"
      class="font-file-input"
      type="file"
      accept=".ttf,.otf,font/ttf,font/otf"
      @change="handleHandwriteFontChange"
    />

    <comment-workspace-toolbar
      v-if="systemStudents.length || excelStudentCount"
      :source="source"
      :system-student-count="systemStudents.length"
      :excel-file-name="excelFileName"
      :excel-student-count="excelStudentCount"
      :completed-count="completedCount"
      :total-count="totalCount"
      :percentage="percentage"
      :has-data="hasWorkspaceData"
      :batch-processing="batchProcessing"
      :exporting="textExporting"
      :handwrite-font-name="savedHandwriteFontName"
      :display-handwrite-font-name="displayHandwriteFontName"
      :handwrite-font-applying="handwriteFontApplying"
      @source-change="handleSourceChange"
      @upload="handleUploadRequest"
      @batch-action="handleBatchAction"
      @export-action="handleExportAction"
      @reset="handleResetComments"
      @choose-font="handleChooseHandwriteFont"
      @clear-font="handleClearHandwriteFont"
    />

    <el-alert
      v-if="showDefaultFontSlowNotice"
      class="font-slow-alert"
      title="手写字体加载较慢，可选择本地 .ttf/.otf 字体提升预览和导出稳定性。"
      type="warning"
      show-icon
      :closable="false"
    />

    <div v-if="hasWorkspaceData" class="evaluation-page-content">
      <div class="evaluation-page-left">
        <evaluation-table-view
          ref="evaluationTableViewRef"
          :active-student-id="activeStudentId"
          :preview-mode="previewMode"
          :students="students"
          @card-click="handleCardClick"
        />
      </div>
      <div class="evaluation-page-right">
        <el-scrollbar>
          <tool-panel-view
            ref="toolPanelViewRef"
            :students="students"
            :tag-category-list="tagCategories"
            :allow-tag-editing="allowTagEditing"
            @scroll="(studentId) => evaluationTableViewRef?.scroll(studentId)"
            @active-student-change="handleActiveStudentChange"
          />
        </el-scrollbar>
      </div>
    </div>

    <div v-else class="comment-workspace-empty">
      <div class="comment-workspace-empty__icon">
        <font-awesome-icon :icon="['solid', 'file-excel']" />
      </div>
      <h3>上传 Excel 开始处理评语</h3>
      <p>当前没有系统学生，可临时导入其他班级名单；数据只在本页面使用，不会写入系统。</p>
      <el-button type="primary" size="large" @click="handleUploadRequest">
        <template #icon><font-awesome-icon :icon="['solid', 'file-arrow-up']" /></template>
        上传 Excel
      </el-button>
    </div>

    <comment-excel-import-dialog v-model="importDialogVisible" @confirm="handleExcelImport" />
  </div>
</template>

<style scoped lang="scss">
.evaluation-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.evaluation-page-header {
  :deep(.header-left) {
    min-width: 220px;
    flex-shrink: 0;
  }
}

.font-file-input {
  display: none;
}

.font-slow-alert {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.evaluation-page-content {
  flex: 1;
  display: flex;
  gap: 0;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.045);

  .evaluation-page-left {
    height: 100%;
    flex: 6;
    min-width: 0;
  }

  .evaluation-page-right {
    height: 100%;
    flex: 2;
    min-width: 300px;
    padding: 8px 4px;
    background: #f8fafc;
    border-left: 1px solid #e2e8f0;
  }
}

.comment-workspace-empty {
  flex: 1;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  background: radial-gradient(circle at 50% 15%, rgba(59, 130, 246, 0.08), transparent 34%), #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;

  h3 {
    margin: 16px 0 6px;
    color: #1e293b;
    font-size: 18px;
    font-weight: 650;
  }

  p {
    max-width: 520px;
    margin: 0 0 22px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.7;
  }
}

.comment-workspace-empty__icon {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 16px;
  font-size: 25px;
  box-shadow: 0 10px 24px rgba(21, 128, 61, 0.1);
}
</style>
