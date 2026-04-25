<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'

import { renderMarkdown } from '@/utils/katexUntil'
import type {
  DashboardEvaluationOverviewType,
  DashboardKpiType,
  DashboardStudentListItemType
} from '@/types/HomeDashboard'

interface Props {
  kpi: DashboardKpiType
  evaluationOverview: DashboardEvaluationOverviewType
  analysisText: string
  analysisGeneratedAt: string
  analysisLoading: boolean
  attentionStudents: DashboardStudentListItemType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  generateAnalysis: []
  goAiSetting: []
  selectAttentionStudent: [name: string]
}>()

const diagnosisTextRef = ref<HTMLElement>()
const analysisDialogVisible = ref(false)
const attentionDialogVisible = ref(false)
const diagnosisOverflow = ref(false)

const diagnosisTitle = computed(() => {
  return props.evaluationOverview.aiConfigured ? 'AI 学情分析' : '模板结论'
})

const diagnosisText = computed(() => {
  if (!props.evaluationOverview.aiConfigured) {
    return props.kpi.diagnosticText
  }

  return props.analysisText || '点击生成分析，基于当前单元分布、预警学生和榜单生成学情情况。'
})

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

const checkDiagnosisOverflow = async () => {
  await nextTick()
  const element = diagnosisTextRef.value
  if (!element) return

  diagnosisOverflow.value = element.scrollHeight > element.clientHeight + 1
}

const openAnalysisDialog = () => {
  analysisDialogVisible.value = true
}

const openAttentionDialog = () => {
  attentionDialogVisible.value = true
}

const handleAttentionStudentSelect = (name: string) => {
  attentionDialogVisible.value = false
  emit('selectAttentionStudent', name)
}

watch(
  diagnosisText,
  () => {
    checkDiagnosisOverflow()
  },
  { immediate: true }
)

useResizeObserver(diagnosisTextRef, () => {
  checkDiagnosisOverflow()
})
</script>

<template>
  <section class="home-kpi-strip">
    <div class="kpi-left-group">
      <div class="kpi-card is-primary">
        <div class="kpi-label">综合平均分</div>
        <div class="kpi-value">{{ kpi.averageScore }}</div>
        <div class="kpi-caption">覆盖 {{ kpi.completedUnitCount }} 个单元</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">及格率稳定性</div>
        <div class="kpi-value">{{ kpi.averagePassRate }}%</div>
        <div class="kpi-caption">波动 {{ kpi.passRateFluctuation }}%</div>
      </div>

      <div class="kpi-card is-warning">
        <div class="kpi-card-header">
          <div class="kpi-label">需关注学生</div>
          <button
            class="kpi-link-btn"
            type="button"
            :disabled="!attentionStudents.length"
            @click="openAttentionDialog"
          >
            {{ attentionStudents.length ? '查看名单' : '暂无名单' }}
          </button>
        </div>
        <div class="kpi-value">{{ kpi.attentionStudentCount }}</div>
        <div class="kpi-caption">命中右侧预警规则</div>
      </div>
    </div>

    <div
      v-loading="showDiagnosisLoadingMask"
      class="kpi-card is-diagnosis"
      element-loading-text="AI 正在生成学情分析"
      element-loading-background="rgba(248, 250, 252, 0.82)"
    >
      <div class="diagnosis-header">
        <div class="kpi-label">
          {{ diagnosisTitle }}
        </div>
        <div class="diagnosis-actions">
          <span v-if="formattedAnalysisTime" class="generated-time">
            {{ formattedAnalysisTime }}
          </span>
          <el-button
            v-if="evaluationOverview.aiConfigured && analysisText"
            size="small"
            type="primary"
            text
            :loading="analysisLoading"
            @click="emit('generateAnalysis')"
          >
            重新生成
          </el-button>
          <el-tooltip v-if="diagnosisOverflow" content="查看完整分析" placement="top">
            <button class="expand-btn" type="button" @click="openAnalysisDialog">
              <font-awesome-icon :icon="['solid', 'up-right-and-down-left-from-center']" />
            </button>
          </el-tooltip>
        </div>
      </div>
      <div v-if="showInlineGenerateAction" ref="diagnosisTextRef" class="diagnosis-text">
        点击
        <button
          class="inline-generate-btn"
          type="button"
          :disabled="analysisLoading"
          @click="emit('generateAnalysis')"
        >
          {{ analysisLoading ? '生成中' : '生成分析' }}
        </button>
        ，基于当前单元分布、预警学生和榜单生成学情情况。
      </div>
      <div v-else ref="diagnosisTextRef" class="diagnosis-text">{{ diagnosisPreviewText }}</div>
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
          {{ analysisText ? '重新生成' : '生成分析' }}
        </el-button>
        <el-button v-else type="primary" @click="emit('goAiSetting')">配置 AI</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="attentionDialogVisible"
      class="attention-dialog"
      title="需关注学生名单"
      width="560px"
    >
      <el-scrollbar max-height="50vh">
        <div v-if="attentionStudents.length" class="attention-dialog-list">
          <button
            v-for="item in attentionStudents"
            :key="item.name"
            class="attention-student-row"
            @click="handleAttentionStudentSelect(item.name)"
          >
            <span class="attention-student-header">
              <span class="attention-student-name">{{ item.name }}</span>
              <span class="attention-student-badge">{{ item.badge }}</span>
            </span>
            <span class="attention-student-subtitle">{{ item.subtitle }}</span>
          </button>
        </div>
        <el-empty v-else :image-size="72" description="暂无需关注学生"></el-empty>
      </el-scrollbar>
      <template #footer>
        <el-button @click="attentionDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.home-kpi-strip {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(340px, 3fr);
  gap: 12px;
}

.kpi-left-group {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.kpi-card {
  min-width: 0;
  min-height: 104px;
  padding: 14px 16px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: var(--shadow-card);
}

.kpi-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.kpi-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.kpi-value {
  margin-top: 6px;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.kpi-caption {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.kpi-link-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  &:disabled {
    color: #94a3b8;
    cursor: default;
  }

  &:not(:disabled):hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.diagnosis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.diagnosis-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.generated-time {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}

:deep(.diagnosis-text) {
  margin-top: 7px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
}

.expand-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dbe7f3;
  border-radius: 6px;
  background: #ffffff;
  color: #64748b;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    color: var(--theme-primary);
    border-color: color-mix(in srgb, var(--theme-primary) 28%, #ffffff);
    background: color-mix(in srgb, var(--theme-primary) 6%, #ffffff);
  }

  svg {
    font-size: 11px;
  }
}

.diagnosis-text {
  height: 52px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.inline-generate-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--theme-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.72;
  }

  &:not(:disabled):hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

:global(.analysis-dialog .el-dialog__body) {
  padding-top: 8px;
}

.analysis-dialog-content {
  padding: 14px 16px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #f8fafc;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.8;

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 14px 0 8px;
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 700;

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(p) {
    margin: 0 0 12px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 12px;
    padding-left: 20px;
  }

  :deep(li) {
    margin-bottom: 5px;
  }

  :deep(strong) {
    color: #0f172a;
  }
}

.attention-dialog-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-right: 2px;
}

.attention-student-row {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #f8fafc;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--theme-primary) 24%, #ffffff);
    background: #ffffff;
  }
}

.attention-student-header {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.attention-student-name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-student-subtitle {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-line;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.attention-student-badge {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: #fef3c7;
  color: #b45309;
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 720px) {
  .attention-dialog-list {
    grid-template-columns: 1fr;
  }
}

.is-primary {
  border-color: color-mix(in srgb, var(--theme-primary) 22%, #ffffff);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--theme-primary) 8%, #ffffff),
    #ffffff
  );
}

.is-warning {
  border-color: #fde68a;
  background: linear-gradient(135deg, #fffbeb, #ffffff);

  .kpi-value {
    color: #d97706;
  }
}

.is-diagnosis {
  background: #f8fafc;
}

@media (max-width: 1280px) {
  .home-kpi-strip {
    grid-template-columns: 1fr;
  }

  .kpi-left-group {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .kpi-left-group {
    grid-template-columns: 1fr;
  }
}
</style>
