<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElLoading, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

import EvaluationTableView from '@/views/evaluation/components/EvaluationTableView.vue'
import ToolPanelView from '@/views/evaluation/components/ToolPanelView.vue'
import { useProgress } from '@/hooks/useProgress'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { generateBatchComments } from '@/ai/aiService'
import { exportEvaluationTextPDF } from '@/utils/evaluationTextPdfUntil'
import { extractStudentTags } from '@/utils/studentUntil'
import { NAME_PROP } from '@/types/Constants'
import type { PreviewModeType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

/**
 * 期末评语管理页面
 * 展示学生期末评语列表，提供编辑、AI 生成和 PDF 导出功能
 */

const evaluationTableViewRef = ref<InstanceType<typeof EvaluationTableView>>()
const toolPanelViewRef = ref<InstanceType<typeof ToolPanelView>>()
const route = useRoute()
const router = useRouter()

const dataStore = useDataSourceStore()
const { items: students, enabledData: enabledStudents } = storeToRefs(dataStore)
const configuration = useConfigurationStore()
const settingStore = useSettingStore()
const { tagCategory: tagCategoryList } = storeToRefs(settingStore)
const aiConfigStore = useAIConfigStore()
const { percentage, notCompletedCount } = useProgress({
  data: students,
  getValue: (item: StudentDataType) => item.comment
})
const totalCount = computed(() => students.value.length)
const completedCount = computed(() => Math.max(0, totalCount.value - notCompletedCount.value))
const activeStudentName = ref('')
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

/**
 * 批量生成中状态
 */
const batchGenerating = ref(false)
const textPdfExporting = ref(false)

/**
 * 自动聚焦到工具面板
 */
const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

const handleExportTextPDF = async () => {
  if (!enabledStudents.value.length) {
    ElMessage.warning('没有可导出的学生期末评语')
    return
  }

  textPdfExporting.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出文字版PDF...'
  })

  try {
    const result = await exportEvaluationTextPDF({
      students: enabledStudents.value,
      configuration
    })

    if (!result.success) {
      ElMessage.error(result.error?.message || '导出失败！')
      return
    }

    ElMessage.success('评语导出成功')

    if (result.truncatedStudents.length > 0) {
      const previewNames = result.truncatedStudents.slice(0, 5).join('、')
      const suffix = result.truncatedStudents.length > 5 ? ' 等' : ''
      ElMessage.warning(
        `有 ${result.truncatedStudents.length} 条评语因内容过长被截断：${previewNames}${suffix}`
      )
    }
  } finally {
    loading.close()
    textPdfExporting.value = false
  }
}

/**
 * 处理评语卡片点击事件
 * 点击左侧学生期末评语卡片时，激活右侧输入区进行编辑
 * @param row - 被点击的学生行数据
 */
const handleCardClick = (row: StudentDataType) => {
  toolPanelViewRef.value?.fillStudentData(row)
}

const handleActiveStudentChange = (row: StudentDataType | null) => {
  activeStudentName.value = row ? getStudentName(row) : ''
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

const resumeEditingStudent = async (studentName: string) => {
  await nextTick()
  const student = students.value.find((item) => getStudentName(item) === studentName)
  if (!student || !toolPanelViewRef.value) return false

  toolPanelViewRef.value.fillStudentData(student)
  return true
}

const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

const formatBatchTags = (tags: string[]): string => {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
  return uniqueTags.length ? uniqueTags.join('、') : '暂无'
}

const handleBatchGenerate = async () => {
  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先在设置页面配置 AI')
    return
  }

  if (!students.value.length) {
    ElMessage.warning('没有学生数据')
    return
  }

  // 统计已有评语的学生数量
  const existingCount = students.value.filter((item) => item.comment && item.comment.trim()).length
  const emptyCount = students.value.length - existingCount

  // 根据情况选择模式
  let mode: 'skip' | 'overwrite' = 'skip'

  if (existingCount === 0) {
    // 全部为空，直接生成
    mode = 'overwrite'
  } else if (emptyCount === 0) {
    // 全部已有评语，只询问是否覆盖
    try {
      await ElMessageBox.confirm(
        '所有学生已有期末评语，是否全部重新生成？',
        'AI 批量生成期末评语',
        {
          confirmButtonText: '覆盖所有',
          cancelButtonText: '取消',
          type: 'info',
          distinguishCancelAndClose: true
        }
      )
      mode = 'overwrite'
    } catch {
      return
    }
  } else {
    // 部分有评语，弹出选择对话框
    try {
      await ElMessageBox.confirm(
        `检测到 ${students.value.length} 名学生中已有 ${existingCount} 名学生有评语，请选择生成方式`,
        'AI 批量生成期末评语',
        {
          confirmButtonText: '覆盖所有',
          cancelButtonText: '仅填充空白期末评语',
          type: 'info',
          distinguishCancelAndClose: true
        }
      )
      mode = 'overwrite'
    } catch (action) {
      if (action === 'cancel') {
        mode = 'skip'
      } else {
        return
      }
    }
  }

  batchGenerating.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在批量生成期末评语...'
  })

  try {
    // 根据模式构建学生数据
    // 覆盖所有模式：传入空评语让 LLM 重新生成
    // 仅填充空评语模式：只传入评语为空的学生
    const filteredStudents = students.value.filter(
      (item) => mode === 'overwrite' || !item.comment?.trim()
    )

    const studentsData = filteredStudents.map((item) => {
      const allTags = extractStudentTags(item, tagCategoryList.value)

      return {
        name: getStudentName(item),
        tags: formatBatchTags(allTags),
        comment: mode === 'overwrite' ? '' : (item.comment || '')
      }
    })

    // 分批处理，每批10个学生，降低单次请求体积和失败影响范围。
    const BATCH_SIZE = 10
    const totalBatches = Math.ceil(studentsData.length / BATCH_SIZE)
    const allResults: Array<{ name: string; comment: string | null }> = []
    let failedBatches: number[] = []

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, studentsData.length)
      const batchData = studentsData.slice(start, end)

      loading.setText(`正在生成第 ${batchIndex + 1}/${totalBatches} 批期末评语...`)

      try {
        const result = await generateBatchComments(batchData, aiConfigStore.prompts.batchComment, {
          modelType: aiConfigStore.modelType,
          model: aiConfigStore.model,
          apiKey: aiConfigStore.apiKey,
          baseUrl: aiConfigStore.baseUrl
        })

        allResults.push(...(result as Array<{ name: string; comment: string | null }>))
      } catch (error) {
        console.error(`第 ${batchIndex + 1} 批生成失败:`, error)
        failedBatches.push(batchIndex + 1)
        // 批次失败时，尝试下一个批次
      }
    }

    if (failedBatches.length > 0) {
      ElMessage.warning(`部分批次生成失败：第 ${failedBatches.join('、')} 批（共 ${totalBatches} 批）`)
    }

    // 更新成功生成的结果
    let updatedCount = 0
    for (let i = 0; i < allResults.length; i++) {
      const generatedComment = allResults[i].comment?.trim()
      if (generatedComment) {
        filteredStudents[i].comment = generatedComment
        updatedCount++
      }
    }

    ElMessage.success(`批量生成完成，已更新 ${updatedCount} 条期末评语`)
  } catch (error) {
    console.error('批量生成期末评语失败:', error)
    ElMessage.error('批量生成期末评语失败：' + (error as Error).message)
  } finally {
    loading.close()
    batchGenerating.value = false
  }
}

watch(
  () => [route.query['resume-edit'], route.query['student-name'], !!toolPanelViewRef.value] as const,
  async ([resumeEdit, studentName, ready]) => {
    if (resumeEdit !== '1' || typeof studentName !== 'string' || !studentName || !ready) return

    const resumed = await resumeEditingStudent(studentName)
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
      :icon="['solid', 'comments']"
      title="期末评语"
      subtitle="为每位学生撰写期末评语，支持导出评语 PDF"
    />

    <div class="evaluation-toolbar">
      <div class="progress-section">
        <div class="progress-title">
          <span class="label">
            <font-awesome-icon :icon="['solid', 'chart-pie']" />
            期末评语进度
          </span>
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
          <span class="percentage-badge">{{ percentage.toFixed(0) }}%</span>
          <span class="meta-text">已完成 {{ completedCount }}/{{ totalCount }}</span>
          <span class="meta-text warning" v-if="percentage < 100">剩余 {{ notCompletedCount }} 人</span>
          <span class="meta-text success" v-else>
            <font-awesome-icon :icon="['solid', 'circle-check']" />
            全部完成
          </span>
        </div>
      </div>

      <div class="toolbar-actions">
        <el-button type="danger" plain @click="handleResetComments">
          <template #icon><font-awesome-icon :icon="['solid', 'rotate-left']" /></template>
          重置期末评语
        </el-button>
        <el-button type="primary" :loading="batchGenerating" @click="handleBatchGenerate">
          <template #icon><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" /></template>
          AI 批量生成期末评语
        </el-button>
        <el-button :loading="textPdfExporting" @click="handleExportTextPDF">
          <template #icon><font-awesome-icon :icon="['solid', 'file-lines']" /></template>
          导出期末评语
        </el-button>
      </div>
    </div>

    <div class="evaluation-page-content">
      <div class="evaluation-page-left">
        <evaluation-table-view
          ref="evaluationTableViewRef"
          :active-student-name="activeStudentName"
          :preview-mode="previewMode"
          @card-click="handleCardClick"
        />
      </div>
      <div class="evaluation-page-right">
        <el-scrollbar>
          <tool-panel-view
            ref="toolPanelViewRef"
            @scroll="(index) => evaluationTableViewRef?.scroll(index)"
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

.evaluation-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid var(--border-muted);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  margin-bottom: 10px;

  .progress-section {
    width: clamp(360px, 44vw, 560px);
    flex: 0 0 auto;
    padding: 8px 10px;
    border: 1px solid #e6edf5;
    border-radius: 10px;
    background: linear-gradient(180deg, #fbfdff 0%, #f7fbff 100%);
    display: flex;
    align-items: center;
    gap: 10px;

    .progress-title {
      flex-shrink: 0;

      .label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #64748b;

        svg {
          color: var(--theme-primary);
          font-size: 12px;
        }
      }

    }

    .progress-bar-wrap {
      flex: 1;
      min-width: 80px;
    }

    .progress-meta {
      display: flex;
      align-items: center;
      gap: 8px;
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
      }

      .meta-text.warning {
        color: #b45309;
      }

      .meta-text.success {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #166534;
      }
    }
  }

  .toolbar-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    :deep(.el-button) {
      height: 36px;
    }

  }
}

@media (max-width: 1080px) {
  .evaluation-toolbar {
    flex-wrap: wrap;

    .progress-section {
      width: 100%;
    }

    .toolbar-actions {
      margin-left: 0;
      width: 100%;
      justify-content: flex-end;
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
