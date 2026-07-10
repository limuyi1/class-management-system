<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

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

const dataStore = useDataSourceStore()
const { students, enabledData: enabledStudents } = storeToRefs(dataStore)
const configuration = useConfigurationStore()
const settingStore = useSettingStore()
const { tagCategories: tagCategoryList } = storeToRefs(settingStore)
const aiConfigStore = useAIConfigStore()
const { percentage, notCompletedCount } = useProgress({
  data: students,
  getValue: (item: StudentDataType) => item.comment
})
const totalCount = computed(() => students.value.length)
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
    tagCategoryList,
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
    enabledStudents,
    configuration
  })
const textExporting = computed(() => textPdfExporting.value || textExcelExporting.value)

/**
 * 自动聚焦到工具面板
 */
const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

const handleMoreAction = (command: string | number | object) => {
  if (command !== 'reset-comments') return

  void handleResetComments()
}

const handleExportAction = (command: string | number | object) => {
  if (command === 'pdf') {
    void handleExportTextPDF()
    return
  }

  if (command === 'excel') {
    void handleExportTextExcel()
  }
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
  () =>
    [route.query['resume-edit'], route.query['student-id'], !!toolPanelViewRef.value] as const,
  async ([resumeEdit, studentId, ready]) => {
    if (resumeEdit !== '1' || typeof studentId !== 'string' || !studentId || !ready) return

    const resumed = await resumeEditingStudent(studentId)
    if (resumed) {
      await router.replace({ path: '/comment' })
    }
  },
  { immediate: true }
)

defineExpose({ autoFocus })
</script>

<template>
  <div class="evaluation-page app-page-shell">
    <page-header
      class="evaluation-page-header"
      :icon="['solid', 'comments']"
      title="期末评语"
      subtitle="为每位学生撰写期末评语，支持导出评语 PDF"
    >
      <template #right>
        <div class="header-toolbar">
          <div class="header-progress" title="评语完成进度">
            <div class="progress-title">
              <font-awesome-icon :icon="['solid', 'chart-pie']" />
              <span>进度</span>
            </div>
            <div class="progress-bar-wrap">
              <el-progress
                class="progress-track"
                :percentage="percentage"
                :stroke-width="6"
                :show-text="false"
                color="var(--theme-primary)"
              />
            </div>
            <div class="progress-meta">
              <span class="meta-text">完成 {{ completedCount }}/{{ totalCount }}</span>
              <span class="percentage-badge">{{ percentage.toFixed(0) }}%</span>
            </div>
          </div>

          <input
            ref="fontFileInputRef"
            class="font-file-input"
            type="file"
            accept=".ttf,.otf,font/ttf,font/otf"
            @change="handleHandwriteFontChange"
          />

          <div class="header-actions">
            <el-button type="primary" :loading="batchGenerating" @click="handleBatchGenerate">
              <template #icon
                ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
              /></template>
              AI 批量生成
            </el-button>
            <el-button :loading="batchPolishing" @click="handleBatchPolish">
              <template #icon
                ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
              /></template>
              AI 批量润色
            </el-button>
            <el-dropdown trigger="click" placement="bottom-end" @command="handleExportAction">
              <el-button :loading="textExporting">
                <template #icon><font-awesome-icon :icon="['solid', 'file-export']" /></template>
                导出
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pdf">
                    <font-awesome-icon :icon="['solid', 'file-pdf']" />
                    <span>导出 PDF</span>
                  </el-dropdown-item>
                  <el-dropdown-item command="excel">
                    <font-awesome-icon :icon="['solid', 'file-excel']" />
                    <span>导出 Excel</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <el-dropdown trigger="click" placement="bottom-end" @command="handleMoreAction">
              <el-button class="more-action-btn">
                <template #icon><font-awesome-icon :icon="['solid', 'ellipsis']" /></template>
                更多
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item class="font-dropdown-item" @click.stop>
                    <div class="font-control-row">
                      <div
                        class="font-status-item"
                        :title="savedHandwriteFontName || '默认手写字体'"
                      >
                        <font-awesome-icon :icon="['solid', 'font']" />
                        <span>{{
                          savedHandwriteFontName ? displayHandwriteFontName : '默认手写字体'
                        }}</span>
                      </div>
                      <button
                        class="font-mini-action"
                        type="button"
                        :disabled="handwriteFontApplying"
                        @click.stop="handleChooseHandwriteFont"
                      >
                        {{ handwriteFontApplying ? '应用中' : '更换' }}
                      </button>
                      <button
                        v-if="savedHandwriteFontName"
                        class="font-mini-action is-muted"
                        type="button"
                        @click.stop="handleClearHandwriteFont"
                      >
                        默认
                      </button>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="reset-comments" divided>
                    <font-awesome-icon :icon="['solid', 'trash-can']" />
                    <span>重置评语</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
    </page-header>

    <el-alert
      v-if="showDefaultFontSlowNotice"
      class="font-slow-alert"
      title="手写字体加载较慢，可选择本地 .ttf/.otf 字体提升预览和导出稳定性。"
      type="warning"
      show-icon
      :closable="false"
    />

    <div class="evaluation-page-content">
      <div class="evaluation-page-left">
        <evaluation-table-view
          ref="evaluationTableViewRef"
          :active-student-id="activeStudentId"
          :preview-mode="previewMode"
          @card-click="handleCardClick"
        />
      </div>
      <div class="evaluation-page-right">
        <el-scrollbar>
          <tool-panel-view
            ref="toolPanelViewRef"
            @scroll="(studentId) => evaluationTableViewRef?.scroll(studentId)"
            @active-student-change="handleActiveStudentChange"
          />
        </el-scrollbar>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.evaluation-page {
  min-height: 0;
}

.evaluation-page-header {
  :deep(.header-left) {
    min-width: 220px;
    flex-shrink: 0;
  }

  :deep(.header-right) {
    flex: 1;
    justify-content: flex-end;
    min-width: 0;
  }
}

.header-toolbar {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.header-progress {
  width: clamp(240px, 28vw, 360px);
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 16%, #ffffff);
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-color-primary) 6%, #ffffff);
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex-shrink: 1;

  .progress-title {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;

    svg {
      color: var(--theme-primary);
      font-size: 12px;
    }
  }

  .progress-bar-wrap {
    flex: 1;
    min-width: 54px;
  }

  .progress-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;

    .percentage-badge {
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: var(--theme-primary);
      background: color-mix(in srgb, var(--theme-primary) 14%, #ffffff);
    }

    .meta-text {
      font-size: 11px;
      color: #64748b;
      white-space: nowrap;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  :deep(.el-button) {
    height: 36px;
    margin-left: 0;
  }
}

.font-file-input {
  display: none;
}

.font-slow-alert {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.more-action-btn {
  min-width: 78px;
}

.font-dropdown-item {
  cursor: default;

  &:hover,
  &:focus {
    background: transparent;
  }
}

.font-control-row {
  min-width: 218px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.font-status-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.font-mini-action {
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 24%, #ffffff);
  border-radius: 6px;
  padding: 0 8px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, #ffffff);
  color: var(--el-color-primary);
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;

  &:hover {
    border-color: color-mix(in srgb, var(--el-color-primary) 40%, #ffffff);
    background: color-mix(in srgb, var(--el-color-primary) 12%, #ffffff);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.is-muted {
    border-color: #e2e8f0;
    background: #ffffff;
    color: #64748b;

    &:hover {
      color: #334155;
      border-color: #cbd5e1;
      background: #f8fafc;
    }
  }
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 14px;
    color: #64748b;
  }
}

@media (max-width: 1180px) {
  .evaluation-page-header {
    :deep(.header-right) {
      flex: 1;
    }
  }

  .header-progress {
    width: 220px;

    .progress-title span {
      display: none;
    }
  }
}

.evaluation-page-content {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;

  .evaluation-page-left {
    height: 100%;
    flex: 6;
    min-width: 0;
  }

  .evaluation-page-right {
    height: 100%;
    flex: 2;
    min-width: 280px;
  }
}
</style>
