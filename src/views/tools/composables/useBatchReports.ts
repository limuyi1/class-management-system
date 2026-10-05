import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { ElMessage } from 'element-plus'

import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useWorkspaceTaskLock } from '@/hooks/useWorkspaceTaskLock'
import { useWorkspaceScores } from '@/hooks/useWorkspaceScores'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { generateStudentReportSummary } from '@/ai/reportService'
import { buildStudentReportData, buildStudentReportTemplateText } from '@/utils/studentReportUtil'
import { renderDomPngBlob } from '@/utils/domImageUtil'
import { createStoredZip } from '@/utils/zipUtil'
import { createBatchImagePdf } from '@/utils/batchImageExportUtil'
import { downloadBlob, sanitizeExportFileName } from '@/utils/downloadUtil'

import type { PrintStudentType } from '@/types/PrintTools'
import type { StudentReportDataType } from '@/types/StudentReport'
import type { ZipEntryType } from '@/utils/zipUtil'

/** 一名学生在本批次中冻结的报告、正文与输出名称。 */
interface ReportJobType {
  id: string
  report: StudentReportDataType
  content: string
  name: string
}

/** 组织学习报告快照、正文和串行导出队列，保留已完成结果以便重试。 */
export function useBatchReports() {
  const router = useRouter()
  const workspace = useWorkspaceStore()
  const settings = useSettingStore()
  const ai = useAIConfigStore()
  const aiConfigured = computed(() => ai.isConfigured)
  const { projection } = useWorkspaceScores()
  const students = ref<PrintStudentType[]>([])
  const selectedProps = ref<string[]>([])
  const selectedId = ref('')
  const useAI = ref(false)
  const busy = ref(false)
  const saving = ref(false)
  useWorkspaceTaskLock(
    computed(() => busy.value || saving.value),
    '学习报告正在生成或下载，请先停止任务或等待完成'
  )
  const stopped = ref(false)
  const progress = ref(0)
  const total = ref(0)
  const errorIds = ref<string[]>([])
  const exportNode = ref<HTMLElement>()
  const exportJob = shallowRef<ReportJobType | null>(null)
  const completed = shallowRef<Map<string, ZipEntryType>>(new Map())
  const jobSnapshot = shallowRef<ReportJobType[]>([])
  const batchName = ref('学习报告')
  const drafts = ref<Record<string, string>>({})

  watch(
    () => projection.value.normalizedHeaders.map((header) => header.prop),
    (props) => {
      selectedProps.value = props
    },
    { immediate: true }
  )
  const jobs = computed<ReportJobType[]>(() =>
    students.value.flatMap((student, index) => {
      const row = projection.value.normalizedStudents.find((item) => item.studentId === student.id)
      if (!row) return []
      const report = buildStudentReportData({
        student: row,
        students: projection.value.normalizedStudents,
        scoreColumns: projection.value.normalizedHeaders,
        selectedProps: selectedProps.value,
        historicalScores: projection.value.referenceScores,
        historicalRanks: projection.value.rankByProp,
        tagCategories: settings.tagCategories,
        classLabel: `${workspace.activePeriod?.className || ''} · ${workspace.activePeriod?.termName || ''}（百分制）`
      })
      if (!report.scoreItems.some((item) => item.score !== null)) return []
      return [
        {
          id: student.id,
          report,
          content: drafts.value[student.id] ?? buildStudentReportTemplateText(report),
          name: sanitizeExportFileName(
            `${index + 1}-${report.studentName}.png`,
            `学生${index + 1}.png`
          )
        }
      ]
    })
  )
  watch(jobs, (items) => {
    if (!items.some((item) => item.id === selectedId.value)) selectedId.value = items[0]?.id || ''
  })
  // 更改分析范围后丢弃旧正文，防止旧结论套到新成绩。
  watch(
    selectedProps,
    () => {
      drafts.value = {}
    },
    { deep: true }
  )
  const current = computed(() => jobs.value.find((item) => item.id === selectedId.value))
  const completedEntries = computed(() =>
    jobSnapshot.value.flatMap((job) =>
      completed.value.has(job.id) ? [completed.value.get(job.id)!] : []
    )
  )

  /** 按学生串行渲染，保留失败项目与已完成文件以便重试和部分下载。 */
  async function generate(retry = false): Promise<void> {
    if (busy.value) return
    if (!retry) {
      jobSnapshot.value = JSON.parse(JSON.stringify(jobs.value)) as ReportJobType[]
      completed.value = new Map()
      errorIds.value = []
      batchName.value = sanitizeExportFileName(
        `${workspace.activePeriod?.className || '班级'}-${workspace.activePeriod?.termName || ''}-学习报告`,
        '学习报告'
      )
    }
    const tasks = jobSnapshot.value.filter((job) => !completed.value.has(job.id))
    const aiEnabled = useAI.value
    const config = {
      modelType: ai.modelType,
      model: ai.model,
      apiKey: ai.apiKey,
      baseUrl: ai.baseUrl
    }
    busy.value = true
    stopped.value = false
    total.value = tasks.length
    progress.value = 0
    try {
      for (const job of tasks) {
        if (stopped.value) break
        try {
          if (aiEnabled) {
            const content = await generateStudentReportSummary(
              {
                name: job.report.studentName,
                tags: job.report.tags,
                score: job.report.scoreItems.map((item) => ({
                  label: item.label,
                  value: item.score
                }))
              },
              config
            )
            if (!content.trim()) throw new Error('AI 返回了空正文')
            job.content = content.trim()
          }
          if (stopped.value) break
          exportJob.value = job
          await nextTick()
          // 共用就绪流程等待字体、图片、SVG 图表和自然尺寸布局。
          const reportNode = exportNode.value?.querySelector<HTMLElement>('.student-report-card')
          if (!reportNode) throw new Error('报告预览尚未准备完成')
          const blob = await renderDomPngBlob(reportNode, 2, '#ffffff', '学习报告')
          completed.value = new Map(completed.value).set(job.id, { name: job.name, data: blob })
          drafts.value[job.id] = job.content
          errorIds.value = errorIds.value.filter((id) => id !== job.id)
        } catch (error) {
          console.error(`生成 ${job.report.studentName} 学习报告失败`, error)
          if (!errorIds.value.includes(job.id)) errorIds.value.push(job.id)
        }
        progress.value++
      }
      if (!stopped.value)
        ElMessage.success(
          `已生成 ${completed.value.size} 份报告${errorIds.value.length ? `，${errorIds.value.length} 份失败可重试` : ''}`
        )
    } finally {
      busy.value = false
      exportJob.value = null
    }
  }

  /** 下载当前批次已完成文件，不重新生成正文。 */
  async function download(format: 'zip' | 'pdf'): Promise<void> {
    saving.value = true
    try {
      const blob =
        format === 'zip'
          ? await createStoredZip(completedEntries.value)
          : await createBatchImagePdf(completedEntries.value)
      downloadBlob(blob, `${batchName.value}.${format}`)
    } catch (error) {
      console.error(error)
      ElMessage.error('下载失败，请重试')
    } finally {
      saving.value = false
    }
  }
  onBeforeRouteLeave(() => {
    if (busy.value || saving.value) {
      ElMessage.warning('请先停止生成或等待下载完成')
      return false
    }
  })
  onBeforeUnmount(() => {
    stopped.value = true
  })

  return {
    router,
    projection,
    aiConfigured,
    students,
    selectedProps,
    selectedId,
    useAI,
    busy,
    saving,
    stopped,
    progress,
    total,
    errorIds,
    exportNode,
    exportJob,
    completed,
    jobSnapshot,
    drafts,
    jobs,
    current,
    generate,
    download
  }
}
