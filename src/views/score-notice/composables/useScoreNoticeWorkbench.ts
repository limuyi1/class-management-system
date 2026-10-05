/** 成绩通知单页面 — 等级/分数制通知单导入、预览、评语编辑和导出 */
import { computed, onMounted, ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useScoreNoticeComments } from './useScoreNoticeComments'
import { useScoreNoticeExport } from './useScoreNoticeExport'

import { useWorkspaceTaskLock } from '@/hooks/useWorkspaceTaskLock'

import { useAIConfigStore } from '@/stores/ai-config'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { ScoreNoticeCommentStatusEnum } from '@/types/ScoreNotice'
import { useEvaluationHandwriteFont } from '@/views/evaluation/composables/useEvaluationHandwriteFont'

import type { ScoreNoticeImportResultType } from '@/types/ScoreNotice'

/** 预览子组件对外暴露的方法：获取报告根元素 */
interface PreviewExposeType {
  getElement: () => HTMLElement | null
}

/** 控制面板子组件对外暴露的方法：填充评语草稿 */
interface ControlPanelExposeType {
  setCommentDraft: (comment: string) => void
  hasUnsavedComment: boolean
}

/** 批量生成模式：overwrite 覆盖全部，skip 仅处理空评语 */
type BatchGenerateModeType = 'overwrite' | 'skip'

/** 原通知业务逻辑与工作台布局分离，保留既有数据、评语和字体流程。 */
export function useScoreNoticeWorkbench() {
  // 页面依赖的各 store 与路由实例
  const store = useScoreNoticeStore()

  const router = useRouter()

  const aiConfigStore = useAIConfigStore()

  const aiConfigured = computed(() => aiConfigStore.isConfigured)

  const configuration = useConfigurationStore()

  const dataStore = useDataSourceStore()

  const importDialogVisible = ref(false)

  const batchGenerating = ref(false)

  const batchProcessed = ref(0)

  const batchTotal = ref(0)

  const stopBatchRequested = ref(false)

  const singleGenerating = ref(false)

  const previewRef = ref<PreviewExposeType | null>(null)

  const exportPreviewRef = ref<PreviewExposeType | null>(null)

  const { generateForStudents, generateSingleDraft } = useScoreNoticeComments()
  const {
    exporting,
    copying,
    exportProcessed,
    exportStudent,
    exportContext,
    handleStopExport,
    handleCopyImage,
    handleDownloadImage,
    handleExportZip,
    handleExportPdf
  } = useScoreNoticeExport(previewRef, exportPreviewRef)

  const controlPanelRef = ref<ControlPanelExposeType | null>(null)

  const fontFileInputRef = ref<HTMLInputElement | null>(null)

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

  /** 生成当前选中学生的评语草稿并填充到编辑框 */
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

  /**
   * 批量生成评语，分批执行以避免一次性请求过多。
   * @param mode overwrite 覆盖全部，skip 仅处理空评语
   */
  const handleGenerateBatch = async (mode: BatchGenerateModeType): Promise<void> => {
    // 候选学生排除“数据缺失”与“正在生成中”两类
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
    // skip 模式下只处理空评语学生，overwrite 模式处理全部
    const targets = candidates.filter((student) => mode === 'overwrite' || !student.comment.trim())
    if (!targets.length) {
      ElMessage.info('没有待处理的评语')
      return
    }

    batchGenerating.value = true
    stopBatchRequested.value = false
    batchProcessed.value = 0
    batchTotal.value = targets.length
    // 记录生成前的状态，供用户中途停止时回滚“生成中”的学生
    const originalStatuses = new Map(targets.map((student) => [student.id, student.commentStatus]))
    // 每批最多生成 5 名学生评语，控制单次请求规模
    const batchSize = 5
    try {
      for (let index = 0; index < targets.length; index += batchSize) {
        if (stopBatchRequested.value) break
        const batch = targets.slice(index, index + batchSize)
        // 先标记为“生成中”再请求，保证界面可感知每批进度
        batch.forEach((student) =>
          store.updateCommentStatus(student.id, ScoreNoticeCommentStatusEnum.Generating)
        )
        try {
          await generateForStudents(batch)
        } catch (error) {
          // 单批失败不中断整体流程，仅将该批学生标记为失败
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
        // 停止时把仍处于“生成中”的学生回滚到批处理前的状态
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

  /** 请求停止批量生成 */
  const handleStopBatch = (): void => {
    stopBatchRequested.value = true
  }

  /** 处理导入确认，写入 store 并汇总提示信息 */
  const handleImportConfirm = (result: ScoreNoticeImportResultType, fileName: string): void => {
    store.applyImport(result, fileName)
    const messages = [`已导入 ${result.students.length} 名学生、${result.subjects.length} 个科目`]
    if (result.duplicateNames.length)
      messages.push(`跳过 ${result.duplicateNames.length} 个重名学生`)
    if (result.invalidCellCount) messages.push(`${result.invalidCellCount} 个单元格无法识别`)
    ElMessage.success(messages.join('，'))
  }

  onMounted(() => {
    void initializeHandwriteFont()
  })
  const busy = computed(
    () =>
      exporting.value ||
      copying.value ||
      batchGenerating.value ||
      singleGenerating.value ||
      handwriteFontApplying.value
  )
  useWorkspaceTaskLock(busy, '通知正在制作或导出，请先结束当前任务')
  onBeforeRouteLeave(async () => {
    if (busy.value) {
      ElMessage.warning('请先停止生成或等待导出完成')
      return false
    }
    if (controlPanelRef.value?.hasUnsavedComment) {
      try {
        await ElMessageBox.confirm('评语修改尚未保存，是否放弃并离开？', '离开制作', {
          type: 'warning'
        })
      } catch {
        return false
      }
    }
  })
  return {
    store,
    router,
    importDialogVisible,
    aiConfigured,
    dataStore,
    batchGenerating,
    batchProcessed,
    batchTotal,
    singleGenerating,
    exporting,
    exportProcessed,
    exportStudent,
    exportContext,
    handleStopExport,
    previewRef,
    exportPreviewRef,
    controlPanelRef,
    fontFileInputRef,
    selectedStudent,
    displayHandwriteFontName,
    savedHandwriteFontName,
    handwriteFontApplying,
    handleChooseHandwriteFont,
    handleClearHandwriteFont,
    handleHandwriteFontChange,
    backToTools,
    handleGenerateBatch,
    handleStopBatch,
    handleGenerateSingle,
    handleImportConfirm,
    handleCopyImage,
    handleDownloadImage,
    handleExportPdf,
    handleExportZip
  }
}
