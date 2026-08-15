<script setup lang="ts">
/** 成绩通知单页面 — 等级/分数制通知单导入、预览、评语编辑和导出 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ElMessage, ElMessageBox } from 'element-plus'
import { startLoading, stopLoading, updateLoadingText } from '@/hooks/useLoading'

import PageHeader from '@/components/PageHeader.vue'
import ScoreNoticeControlPanel from '@/views/score-notice/components/ScoreNoticeControlPanel.vue'
import ScoreNoticeImportDialog from '@/views/score-notice/components/ScoreNoticeImportDialog.vue'
import ScoreNoticePreview from '@/views/score-notice/components/ScoreNoticePreview.vue'
import { generateScoreNoticeComment, generateScoreNoticeComments } from '@/ai/aiService'
import { useAIConfigStore } from '@/stores/ai-config'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { useSettingStore } from '@/stores/setting'
import { ScoreNoticeCommentStatusEnum } from '@/types/ScoreNotice'
import {
  buildGradeSummary,
  buildTemplateScoreNoticeComment,
  getScoreNoticeCommentValidationReasons,
  normalizeScoreNoticeComment
} from '@/utils/score-notice/scoreNoticeCommentUtil'
import {
  copyPngBlob,
  downloadBlob,
  renderScoreNoticeBlob,
  sanitizeFileName
} from '@/utils/score-notice/scoreNoticeImageUtil'
import { createStoredZip } from '@/utils/zipUtil'
import { useEvaluationHandwriteFont } from '@/views/evaluation/composables/useEvaluationHandwriteFont'

import type { AIServiceConfig } from '@/ai/types'
import type { ScoreNoticeImportResultType, ScoreNoticeStudentType } from '@/types/ScoreNotice'
import type { StudentDataType } from '@/types/StudentData'
import type { ScoreNoticeCommentInputType } from '@/ai/aiService'

interface PreviewExposeType {
  getElement: () => HTMLElement | null
}

interface ControlPanelExposeType {
  setCommentDraft: (comment: string) => void
}

type BatchGenerateModeType = 'overwrite' | 'skip'

const store = useScoreNoticeStore()
const router = useRouter()
const aiConfigStore = useAIConfigStore()
const configuration = useConfigurationStore()
const dataStore = useDataSourceStore()
const settingStore = useSettingStore()
const importDialogVisible = ref(false)
const batchGenerating = ref(false)
const batchProcessed = ref(0)
const batchTotal = ref(0)
const stopBatchRequested = ref(false)
const singleGenerating = ref(false)
const exporting = ref(false)
const exportProcessed = ref(0)
const exportStudent = ref<ScoreNoticeStudentType | null>(null)
const previewRef = ref<PreviewExposeType | null>(null)
const exportPreviewRef = ref<PreviewExposeType | null>(null)
const controlPanelRef = ref<ControlPanelExposeType | null>(null)
const fontFileInputRef = ref<HTMLInputElement | null>(null)
const previewViewportRef = ref<HTMLElement | null>(null)
const previewScale = ref(0.68)
let resizeObserver: ResizeObserver | undefined

const selectedStudent = computed(() => store.selectedStudent)
const {
  displayHandwriteFontName,
  handwriteFontApplying,
  handleChooseHandwriteFont,
  handleClearHandwriteFont,
  handleHandwriteFontChange,
  initializeHandwriteFont,
  savedHandwriteFontName
} = useEvaluationHandwriteFont({ configuration, fontFileInputRef })

const backToTools = (): void => {
  router.push('/tools')
}

/** 优先按系统 ID 关联，旧导入数据缺少 ID 时才回退为姓名匹配。 */
const findSourceStudent = (student: ScoreNoticeStudentType): StudentDataType | undefined => {
  return dataStore.students.find(
    (item) => item.studentId === student.sourceStudentId || item.xing4_ming2 === student.name
  )
}

const resolveTrendSummary = (student: ScoreNoticeStudentType): string => {
  const sourceStudent = findSourceStudent(student)
  if (!sourceStudent) return '暂无可靠的历史变化信息'
  const scores = settingStore.enabledScoreColumns
    .map((column) => sourceStudent[column.prop])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (scores.length < 2) return '历史数据较少，重点评价本次表现'
  const difference = scores[scores.length - 1] - scores[0]
  if (difference >= 5) return '近期整体呈进步趋势'
  if (difference <= -5) return '近期状态有所回落，需要温和提醒'
  const range = Math.max(...scores) - Math.min(...scores)
  return range >= 12 ? '近期表现存在一定波动' : '近期表现较为稳定'
}

const resolveTagSummary = (student: ScoreNoticeStudentType): string => {
  const sourceStudent = findSourceStudent(student)
  if (!sourceStudent?.tags) return '暂无日常表现标签'
  return Object.values(sourceStudent.tags).flat().filter(Boolean).join('、') || '暂无日常表现标签'
}

const buildAIInput = (student: ScoreNoticeStudentType): ScoreNoticeCommentInputType => ({
  studentId: student.id,
  name: student.name,
  gradeSummary: buildGradeSummary(student, store.subjects),
  trendSummary: resolveTrendSummary(student),
  tags: resolveTagSummary(student)
})

const getAIServiceConfig = (): AIServiceConfig => ({
  modelType: aiConfigStore.modelType,
  model: aiConfigStore.model,
  apiKey: aiConfigStore.apiKey,
  baseUrl: aiConfigStore.baseUrl
})

const generateForStudents = async (students: ScoreNoticeStudentType[]): Promise<void> => {
  if (!aiConfigStore.isConfigured) {
    students.forEach((student) => {
      store.updateStudentComment(
        student.id,
        normalizeScoreNoticeComment(buildTemplateScoreNoticeComment(student, store.subjects)),
        false
      )
    })
    return
  }

  const config = getAIServiceConfig()
  if (students.length === 1) {
    const student = students[0]
    const comment = await generateScoreNoticeComment(
      buildAIInput(student),
      config,
      aiConfigStore.prompts.scoreNoticeSingleComment
    )
    store.updateStudentComment(student.id, comment, false)
    return
  }

  const results = await generateScoreNoticeComments(
    students.map(buildAIInput),
    config,
    aiConfigStore.prompts.scoreNoticeBatchComment
  )
  const resultMap = new Map(results.map((item) => [item.studentId, item.comment]))
  students.forEach((student) => {
    const comment = resultMap.get(student.id) || ''
    store.updateStudentComment(student.id, comment, false)
  })
}

const generateSingleDraft = async (student: ScoreNoticeStudentType): Promise<string> => {
  if (!aiConfigStore.isConfigured) {
    return normalizeScoreNoticeComment(buildTemplateScoreNoticeComment(student, store.subjects))
  }

  return generateScoreNoticeComment(
    buildAIInput(student),
    getAIServiceConfig(),
    aiConfigStore.prompts.scoreNoticeSingleComment
  )
}

const handleGenerateSingle = async (): Promise<void> => {
  const student = selectedStudent.value
  if (!student || student.commentStatus === ScoreNoticeCommentStatusEnum.Missing) return
  singleGenerating.value = true
  try {
    controlPanelRef.value?.setCommentDraft(await generateSingleDraft(student))
    ElMessage.success(
      aiConfigStore.isConfigured ? '评语已生成，请点击保存修改' : '模板评语已生成，请点击保存修改'
    )
  } catch (error) {
    console.error('生成成绩通知评语失败:', error)
    ElMessage.error('评语生成失败，请稍后重试')
  } finally {
    singleGenerating.value = false
  }
}

const handleGenerateBatch = async (mode: BatchGenerateModeType): Promise<void> => {
  const candidates = store.students.filter(
    (student) =>
      ![ScoreNoticeCommentStatusEnum.Missing, ScoreNoticeCommentStatusEnum.Generating].includes(
        student.commentStatus
      )
  )
  if (!candidates.length) {
    ElMessage.info('没有可生成的评语')
    return
  }

  if (mode === 'overwrite') {
    try {
      await ElMessageBox.confirm(
        `将覆盖 ${candidates.length} 名学生现有评语，生成后仍可逐条修改。是否继续？`,
        '重新生成全部评语',
        {
          confirmButtonText: '确认重新生成',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return
    }
  }
  const targets = candidates.filter((student) => mode === 'overwrite' || !student.comment.trim())
  if (!targets.length) {
    ElMessage.info('没有待处理的评语')
    return
  }

  batchGenerating.value = true
  stopBatchRequested.value = false
  batchProcessed.value = 0
  batchTotal.value = targets.length
  const originalStatuses = new Map(targets.map((student) => [student.id, student.commentStatus]))
  const batchSize = 5
  try {
    for (let index = 0; index < targets.length; index += batchSize) {
      if (stopBatchRequested.value) break
      const batch = targets.slice(index, index + batchSize)
      batch.forEach((student) =>
        store.updateCommentStatus(student.id, ScoreNoticeCommentStatusEnum.Generating)
      )
      try {
        await generateForStudents(batch)
      } catch (error) {
        console.error('批量生成成绩通知评语失败:', error)
        batch.forEach((student) =>
          store.updateCommentStatus(
            student.id,
            ScoreNoticeCommentStatusEnum.Failed,
            error instanceof Error ? error.message : '生成失败'
          )
        )
      }
      batchProcessed.value += batch.length
    }
    if (stopBatchRequested.value) {
      store.students
        .filter((student) => student.commentStatus === ScoreNoticeCommentStatusEnum.Generating)
        .forEach((student) =>
          store.updateCommentStatus(
            student.id,
            originalStatuses.get(student.id) || ScoreNoticeCommentStatusEnum.Pending
          )
        )
      ElMessage.info('已停止批量生成')
    } else {
      ElMessage.success(
        aiConfigStore.isConfigured
          ? `批量评语生成完成，已更新 ${targets.length} 条`
          : `模板评语生成完成，已更新 ${targets.length} 条`
      )
    }
  } finally {
    batchGenerating.value = false
  }
}

const handleStopBatch = (): void => {
  stopBatchRequested.value = true
}

const handleImportConfirm = (result: ScoreNoticeImportResultType, fileName: string): void => {
  store.applyImport(result, fileName)
  const messages = [`已导入 ${result.students.length} 名学生、${result.subjects.length} 个科目`]
  if (result.duplicateNames.length) messages.push(`跳过 ${result.duplicateNames.length} 个重名学生`)
  if (result.invalidCellCount) messages.push(`${result.invalidCellCount} 个单元格无法识别`)
  ElMessage.success(messages.join('，'))
}

const handleCopyImage = async (): Promise<void> => {
  const element = previewRef.value?.getElement()
  if (!element || !selectedStudent.value) return
  startLoading('正在生成高清图片...')
  try {
    const blob = await renderScoreNoticeBlob(element, 2)
    const copied = await copyPngBlob(blob)
    if (copied) {
      ElMessage.success('成绩通知图片已复制，可直接粘贴发送')
      return
    }
    downloadBlob(
      blob,
      `${sanitizeFileName(store.title)}_${sanitizeFileName(selectedStudent.value.name)}.png`
    )
    ElMessage.warning('浏览器未允许复制图片，已改为下载 PNG')
  } catch (error) {
    console.error('生成成绩通知图片失败:', error)
    ElMessage.error('图片生成失败，请稍后重试')
  } finally {
    stopLoading()
  }
}

const waitForRender = async (): Promise<void> => {
  await nextTick()
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
}

const handleExportZip = async (): Promise<void> => {
  const exportableStudents = store.students.filter((student) =>
    Object.values(student.gradeValues).some(Boolean)
  )
  if (!exportableStudents.length) {
    ElMessage.warning('没有可导出的学生成绩')
    return
  }
  const blankStudents = exportableStudents.filter((student) => !student.comment.trim())
  const reviewStudents = exportableStudents.filter(
    (student) =>
      getScoreNoticeCommentValidationReasons(student.comment).length > 0 && student.comment.trim()
  )
  if (blankStudents.length || reviewStudents.length) {
    const details = [
      reviewStudents.length ? `${reviewStudents.length} 名学生的评语需要修改` : '',
      blankStudents.length ? `${blankStudents.length} 名学生尚未生成评语` : ''
    ].filter(Boolean)
    try {
      await ElMessageBox.confirm(
        `${details.join('，')}。这些内容仍会进入报告图片，是否继续导出？`,
        '确认导出',
        { confirmButtonText: '继续导出', cancelButtonText: '返回修改', type: 'warning' }
      )
    } catch {
      return
    }
  }

  exporting.value = true
  exportProcessed.value = 0
  startLoading('正在生成第 1 张成绩通知...')
  const entries: Array<{ name: string; data: Blob }> = []
  const failedNames: string[] = []
  try {
    for (const [index, student] of exportableStudents.entries()) {
      exportStudent.value = student
      updateLoadingText(`正在生成 ${index + 1}/${exportableStudents.length}：${student.name}`)
      await waitForRender()
      const element = exportPreviewRef.value?.getElement()
      if (!element) throw new Error('离屏预览未就绪')
      try {
        const blob = await renderScoreNoticeBlob(element, 1.5)
        entries.push({
          name: `${sanitizeFileName(store.title)}_${sanitizeFileName(student.name)}.png`,
          data: blob
        })
      } catch (error) {
        console.error(`生成 ${student.name} 成绩通知失败:`, error)
        failedNames.push(student.name)
      }
      exportProcessed.value = index + 1
    }

    if (!entries.length) throw new Error('所有图片均生成失败')
    updateLoadingText('正在打包 ZIP...')
    const zipBlob = await createStoredZip(entries)
    downloadBlob(zipBlob, `${sanitizeFileName(store.title)}_${store.noticeDate}.zip`)
    if (failedNames.length) {
      ElMessage.warning(`ZIP 已导出，${failedNames.join('、')}生成失败`)
    } else {
      ElMessage.success(`已导出 ${entries.length} 名学生的成绩通知图片`)
    }
  } catch (error) {
    console.error('批量导出成绩通知失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '批量导出失败')
  } finally {
    exporting.value = false
    exportStudent.value = null
    stopLoading()
  }
}

const updatePreviewScale = (): void => {
  const viewport = previewViewportRef.value
  if (!viewport) return
  const report = previewRef.value?.getElement()
  const availableWidth = Math.max(viewport.clientWidth - 42, 320)
  const availableHeight = Math.max(viewport.clientHeight - 36, 320)
  const reportWidth = report?.offsetWidth || 1448
  const reportHeight = report?.offsetHeight || 1086
  previewScale.value = Math.min(availableWidth / reportWidth, availableHeight / reportHeight, 1)
}

onMounted(() => {
  void initializeHandwriteFont()
  updatePreviewScale()
  if (previewViewportRef.value) {
    resizeObserver = new ResizeObserver(updatePreviewScale)
    resizeObserver.observe(previewViewportRef.value)
  }
  const report = previewRef.value?.getElement()
  if (report) resizeObserver?.observe(report)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="score-notice-page app-page-shell">
    <page-header
      :icon="['solid', 'file-signature']"
      title="成绩通知"
      subtitle="导入考试等级或分数，生成可直接发给家长的成绩图片与短评"
    >
      <template #left>
        <el-tooltip content="返回工具" placement="top">
          <el-button size="small" circle aria-label="返回工具" @click="backToTools">
            <font-awesome-icon :icon="['solid', 'arrow-left']" />
          </el-button>
        </el-tooltip>
      </template>
    </page-header>

    <main class="score-notice-page__workspace">
      <section ref="previewViewportRef" class="score-notice-page__preview">
        <div
          class="score-notice-page__preview-scale"
          :style="{ transform: `translate(-50%, -50%) scale(${previewScale})` }"
        >
          <score-notice-preview
            ref="previewRef"
            :title="store.title"
            :notice-date="store.noticeDate"
            :mode="store.mode"
            :subjects="store.subjects"
            :student="selectedStudent"
          />
        </div>
      </section>

      <score-notice-control-panel
        ref="controlPanelRef"
        :ai-configured="aiConfigStore.isConfigured"
        :batch-generating="batchGenerating"
        :batch-processed="batchProcessed"
        :batch-total="batchTotal"
        :single-generating="singleGenerating"
        :handwrite-font-name="displayHandwriteFontName"
        :has-custom-handwrite-font="Boolean(savedHandwriteFontName)"
        :handwrite-font-applying="handwriteFontApplying"
        :exporting="exporting"
        :export-processed="exportProcessed"
        @open-import="importDialogVisible = true"
        @generate-batch="handleGenerateBatch"
        @stop-batch="handleStopBatch"
        @generate-single="handleGenerateSingle"
        @choose-handwrite-font="handleChooseHandwriteFont"
        @clear-handwrite-font="handleClearHandwriteFont"
        @copy-image="handleCopyImage"
        @export-zip="handleExportZip"
      />
    </main>

    <input
      ref="fontFileInputRef"
      class="score-notice-page__font-file-input"
      type="file"
      accept=".ttf,.otf,font/ttf,font/otf"
      @change="handleHandwriteFontChange"
    />

    <score-notice-import-dialog
      v-model="importDialogVisible"
      :system-students="dataStore.students"
      @confirm="handleImportConfirm"
    />

    <div class="score-notice-page__offscreen" aria-hidden="true">
      <score-notice-preview
        ref="exportPreviewRef"
        :title="store.title"
        :notice-date="store.noticeDate"
        :mode="store.mode"
        :subjects="store.subjects"
        :student="exportStudent"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.score-notice-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.score-notice-page__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 520px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}
.score-notice-page__preview {
  position: relative;
  min-width: 0;
  overflow: hidden;
  min-height: 0;
  background: var(--el-fill-color-light);
}
.score-notice-page__preview-scale {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1448px;
  transform-origin: center center;
}
.score-notice-page__offscreen {
  position: fixed;
  top: 0;
  left: -10000px;
  width: 1448px;
  pointer-events: none;
}
.score-notice-page__font-file-input {
  display: none;
}
@media (max-width: 1180px) {
  .score-notice-page__workspace {
    grid-template-columns: minmax(0, 1fr) 470px;
  }
}
</style>
