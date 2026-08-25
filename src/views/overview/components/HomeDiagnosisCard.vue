<script setup lang="ts">
/** AI 学情诊断卡片 — 展示诊断文本与生成状态，并支持弹窗查看完整分析 */
import { computed, ref } from 'vue'

import { renderMarkdown } from '@/utils/katexUtil'
import type {
  DashboardEvaluationOverviewType,
  OverviewDashboardStageType
} from '@/types/HomeDashboard'

interface Props {
  /** 评语完成情况概览数据 */
  evaluationOverview: DashboardEvaluationOverviewType
  /** AI 生成的学情分析文本 */
  analysisText: string
  /** 分析文本的生成时间 */
  analysisGeneratedAt: string
  /** 是否正在生成分析 */
  analysisLoading: boolean
  /** 总览页当前数据阶段，用于说明诊断依据是否完整 */
  stage: OverviewDashboardStageType
}

const props = defineProps<Props>()

/** 对外事件：触发生成分析、跳转 AI 配置 */
const emit = defineEmits<{
  generateAnalysis: []
  goAiSetting: []
}>()

/** 完整分析弹窗的显示状态 */
const analysisDialogVisible = ref(false)

const diagnosisTitle = computed(() => 'AI 学情分析')

/** 诊断状态标签文案：未配置 / 生成中 / 基础诊断 / 已生成 / 待生成 */
const diagnosisStatusLabel = computed(() => {
  if (!props.evaluationOverview.aiConfigured) return '未配置'
  if (props.analysisLoading) return '生成中'
  if (props.stage !== 'ready' && !hasAnalysisText.value) return '基础诊断'
  return hasAnalysisText.value ? '已生成' : '待生成'
})

/** 诊断状态标签的类型，对应 Element Plus 标签语义色 */
const diagnosisStatusType = computed(() => {
  if (!props.evaluationOverview.aiConfigured) return 'warning'
  if (props.analysisLoading) return 'primary'
  return hasAnalysisText.value ? 'success' : 'info'
})

/**
 * 根据配置状态和生成状态返回不同的提示文案。
 */
const diagnosisText = computed(() => {
  if (!props.evaluationOverview.aiConfigured) {
    return 'AI 学情诊断未启用。配置 AI 后，可基于成绩、评语和标签生成班级诊断建议。'
  }

  if (!props.analysisText && props.stage !== 'ready') {
    return '当前暂无成绩数据，可以先基于评语和标签生成基础班级概况；录入成绩后诊断会更完整。'
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

/** 是否显示卡片内的行内生成按钮（已配置 AI 且尚无分析文本） */
const showInlineGenerateAction = computed(() => {
  return props.evaluationOverview.aiConfigured && !props.analysisText
})

/** 是否显示"正在生成分析"的加载遮罩 */
const showDiagnosisLoadingMask = computed(() => {
  return props.evaluationOverview.aiConfigured && !props.analysisText && props.analysisLoading
})

/** 是否已有分析文本 */
const hasAnalysisText = computed(() => Boolean(props.analysisText.trim()))

/** 格式化后的生成时间（中文日期 + 时分），无生成时间时返回空串 */
const formattedAnalysisTime = computed(() => {
  if (!props.analysisGeneratedAt) return ''
  const date = new Date(props.analysisGeneratedAt)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
})

/** 渲染为 HTML 的诊断内容，支持 Markdown 与数学公式 */
const renderedDiagnosisHtml = computed(() => {
  return renderMarkdown(diagnosisText.value)
})

/** 主操作按钮文案，随 AI 配置与生成状态切换 */
const diagnosisPrimaryActionLabel = computed(() => {
  if (!props.evaluationOverview.aiConfigured) return '配置 AI'
  if (!hasAnalysisText.value && props.stage !== 'ready') return '生成基础诊断'
  return hasAnalysisText.value ? '重新生成' : '生成分析'
})

/** 打开完整分析弹窗 */
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
    <!-- 卡片头部：图标、标题与状态标签 -->
    <div class="diagnosis-header">
      <div class="diagnosis-title-wrap">
        <div class="diagnosis-icon">
          <font-awesome-icon :icon="['solid', 'robot']" />
        </div>
        <div class="diagnosis-title-block">
          <div class="diagnosis-title">{{ diagnosisTitle }}</div>
          <el-tag
            class="diagnosis-status"
            :type="diagnosisStatusType"
            size="small"
            effect="plain"
            round
          >
            {{ diagnosisStatusLabel }}
          </el-tag>
        </div>
      </div>
      <!-- 头部右侧操作区：生成按钮 + 展开按钮 -->
      <div class="diagnosis-actions">
        <el-button
          v-if="evaluationOverview.aiConfigured"
          class="header-generate-btn"
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
          class="header-generate-btn"
          size="small"
          type="primary"
          plain
          @click="emit('goAiSetting')"
        >
          配置 AI
        </el-button>
        <button class="expand-btn" type="button" @click="openAnalysisDialog">
          <font-awesome-icon :icon="['solid', 'up-right-and-down-left-from-center']" />
        </button>
      </div>
    </div>

    <!-- 诊断文本预览区 -->
    <div
      class="diagnosis-text"
      :class="{ 'is-placeholder': showInlineGenerateAction || !evaluationOverview.aiConfigured }"
    >
      {{ diagnosisPreviewText }}
    </div>

    <!-- 底部生成时间展示 -->
    <div class="diagnosis-footer">
      <span class="generated-time"> 生成时间：{{ formattedAnalysisTime || '--' }} </span>
    </div>

    <!-- 完整分析查看弹窗 -->
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
  border: 1px solid color-mix(in srgb, #3b82f6 14%, var(--border-muted));
  background:
    linear-gradient(180deg, color-mix(in srgb, #3b82f6 5%, #ffffff) 0%, #ffffff 68%), #ffffff;
  box-shadow: var(--shadow-card);
  padding: 11px 12px;
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
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.diagnosis-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
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

.diagnosis-title-block {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 6px;
}

.diagnosis-status {
  height: 20px;
}

.diagnosis-actions {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.header-generate-btn {
  min-width: 72px;
  margin-left: 0;
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
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.diagnosis-text.is-placeholder {
  color: #909399;
}

.diagnosis-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid #e8edf5;
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
  .diagnosis-header {
    align-items: flex-start;
  }

  .diagnosis-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .header-generate-btn {
    min-width: 0;
  }
}
</style>
