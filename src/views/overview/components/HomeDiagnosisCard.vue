<script setup lang="ts">
import { computed, ref } from 'vue'

import { renderMarkdown } from '@/utils/katexUntil'
import type { DashboardEvaluationOverviewType } from '@/types/HomeDashboard'

interface Props {
  /** 评语完成情况概览数据 */
  evaluationOverview: DashboardEvaluationOverviewType
  /** AI 生成的学情分析文本 */
  analysisText: string
  /** 分析文本的生成时间 */
  analysisGeneratedAt: string
  /** 是否正在生成分析 */
  analysisLoading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  generateAnalysis: []
  goAiSetting: []
}>()

const analysisDialogVisible = ref(false)

const diagnosisTitle = computed(() => 'AI 学情分析')

/**
 * 根据配置状态和生成状态返回不同的提示文案。
 */
const diagnosisText = computed(() => {
  if (!props.evaluationOverview.aiConfigured) {
    return '暂未配置 AI，配置后可基于当前班级总览自动生成学情分析。'
  }

  return props.analysisText || '暂未生成学情分析，点击下方按钮即可生成。'
})

/**
 * 去除 Markdown 格式，生成纯文本预览。
 * 用于卡片中的三行截断展示。
 */
const diagnosisPreviewText = computed(() => {
  return diagnosisText.value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
})

const showInlineGenerateAction = computed(() => {
  return props.evaluationOverview.aiConfigured && !props.analysisText
})

const showDiagnosisLoadingMask = computed(() => {
  return props.evaluationOverview.aiConfigured && !props.analysisText && props.analysisLoading
})

const hasAnalysisText = computed(() => Boolean(props.analysisText.trim()))

const formattedAnalysisTime = computed(() => {
  if (!props.analysisGeneratedAt) return ''
  const date = new Date(props.analysisGeneratedAt)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
})

const renderedDiagnosisHtml = computed(() => {
  return renderMarkdown(diagnosisText.value)
})

const diagnosisPrimaryActionLabel = computed(() => {
  if (!props.evaluationOverview.aiConfigured) return '配置 AI'
  return hasAnalysisText.value ? '重新生成' : '生成分析'
})

const openAnalysisDialog = () => {
  analysisDialogVisible.value = true
}
</script>

<template>
  <div
    v-loading="showDiagnosisLoadingMask"
    class="diagnosis-card"
    element-loading-text="AI 正在生成学情分析"
    element-loading-background="rgba(248, 250, 252, 0.82)"
  >
    <div class="diagnosis-header">
      <div class="diagnosis-title-wrap">
        <div class="diagnosis-icon">
          <font-awesome-icon :icon="['solid', 'robot']" />
        </div>
        <div class="diagnosis-title">{{ diagnosisTitle }}</div>
      </div>
      <div class="diagnosis-actions">
        <button class="expand-btn" type="button" @click="openAnalysisDialog">
          <font-awesome-icon :icon="['solid', 'up-right-and-down-left-from-center']" />
        </button>
      </div>
    </div>

    <div
      class="diagnosis-text"
      :class="{ 'is-placeholder': showInlineGenerateAction || !evaluationOverview.aiConfigured }"
    >
      {{ diagnosisPreviewText }}
    </div>

    <div class="diagnosis-footer">
      <span class="generated-time"> 生成时间：{{ formattedAnalysisTime || '--' }} </span>
      <div class="diagnosis-footer-actions">
        <el-button
          v-if="evaluationOverview.aiConfigured"
          class="footer-btn"
          size="small"
          type="primary"
          plain
          :loading="analysisLoading"
          @click="emit('generateAnalysis')"
        >
          {{ diagnosisPrimaryActionLabel }}
        </el-button>
        <el-button
          v-else
          class="footer-btn"
          size="default"
          type="primary"
          plain
          @click="emit('goAiSetting')"
        >
          配置 AI
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="analysisDialogVisible"
      class="analysis-dialog"
      :title="diagnosisTitle"
      width="680px"
    >
      <el-scrollbar max-height="52vh">
        <div class="analysis-dialog-content markdown-body" v-html="renderedDiagnosisHtml"></div>
      </el-scrollbar>
      <template #footer>
        <el-button @click="analysisDialogVisible = false">关闭</el-button>
        <el-button
          v-if="evaluationOverview.aiConfigured"
          type="primary"
          :loading="analysisLoading"
          @click="emit('generateAnalysis')"
        >
          {{ diagnosisPrimaryActionLabel }}
        </el-button>
        <el-button v-else type="primary" @click="emit('goAiSetting')">配置 AI</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.diagnosis-card {
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  background: #ffffff;
  box-shadow: var(--shadow-card);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 122px;
}

.diagnosis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.diagnosis-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.diagnosis-icon {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in srgb, #3b82f6 10%, #ffffff);
  border: 1px solid color-mix(in srgb, #3b82f6 20%, #ffffff);
  color: #3b82f6;
  font-size: 14px;
}

.diagnosis-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.diagnosis-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.generated-time {
  font-size: 11px;
  line-height: 1.4;
  color: #909399;
}

.diagnosis-text {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.diagnosis-text.is-placeholder {
  color: #909399;
}

.diagnosis-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid #e8edf5;
}

.diagnosis-footer-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.footer-btn {
  min-width: 84px;
  margin-left: 0;
}

.expand-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #dbe4ee;
  border-radius: 6px;
  background: #ffffff;
  color: #606266;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.expand-btn:hover {
  border-color: #bfd0ff;
  color: #2563eb;
  background: #f8fbff;
}

:deep(.analysis-dialog .el-dialog__body) {
  padding-top: 12px;
}

:deep(.analysis-dialog-content) {
  padding: 16px 18px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
  line-height: 1.8;
  color: var(--text-primary);
}

:deep(.analysis-dialog-content p) {
  margin: 0 0 12px;
  color: var(--text-secondary);
}

:deep(.analysis-dialog-content ul),
:deep(.analysis-dialog-content ol) {
  margin: 0 0 12px;
  padding-left: 22px;
}

:deep(.analysis-dialog-content li) {
  margin-bottom: 6px;
  color: var(--text-secondary);
}

:deep(.analysis-dialog-content h1),
:deep(.analysis-dialog-content h2),
:deep(.analysis-dialog-content h3),
:deep(.analysis-dialog-content h4),
:deep(.analysis-dialog-content h5),
:deep(.analysis-dialog-content h6) {
  margin: 20px 0 10px;
  font-weight: 700;
  color: var(--text-primary);
}

:deep(.analysis-dialog-content h1) {
  font-size: 24px;
}

:deep(.analysis-dialog-content h2) {
  font-size: 20px;
}

:deep(.analysis-dialog-content h3) {
  font-size: 17px;
}

:deep(.analysis-dialog-content h4) {
  font-size: 15px;
}

:deep(.analysis-dialog-content blockquote) {
  margin: 12px 0;
  padding-left: 14px;
  border-left: 4px solid #cbd5e1;
  color: #64748b;
}

:deep(.analysis-dialog-content code) {
  padding: 2px 6px;
  border-radius: 4px;
  background: #eef2f7;
  font-family: monospace;
}

:deep(.analysis-dialog-content pre) {
  margin: 12px 0;
  padding: 12px;
  border-radius: 10px;
  background: #eef2f7;
  overflow-x: auto;
}

:deep(.analysis-dialog-content pre code) {
  padding: 0;
  background: transparent;
}

:deep(.analysis-dialog-content table) {
  width: 100%;
  margin: 12px 0;
  border-collapse: collapse;
}

:deep(.analysis-dialog-content th),
:deep(.analysis-dialog-content td) {
  padding: 8px 10px;
  border: 1px solid #dbe4ee;
  text-align: left;
}

:deep(.analysis-dialog-content th) {
  background: #eef2f7;
}

@media (max-width: 768px) {
  .diagnosis-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .diagnosis-footer-actions {
    width: 100%;
  }

  .footer-btn {
    flex: 1;
    min-width: 0;
  }
}
</style>
