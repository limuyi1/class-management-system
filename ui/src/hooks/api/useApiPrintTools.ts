import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import { readTeachingSnapshot } from '@/api/teaching'
import { useApiPrintExport } from '@/hooks/api/useApiPrintExport'
import { createRosterSettings, paginateRoster } from '@/utils/rosterPrintUtil'
import { paginateExamPrint } from '@/utils/examPrintUtil'
import { createCardTemplate, renderCardTemplate } from '@/utils/cardTemplateUtil'
import { printCanvasBlob } from '@/utils/printCanvasUtil'
import { renderPrintPaperBlob } from '@/utils/printPaperExportUtil'
import RosterPaper from '@/views/tools/components/roster/RosterPaper.vue'
import ExamPaper from '@/views/tools/components/exam/ExamPaper.vue'
import { RosterTemplateEnum } from '@/types/PrintTools'
import type { ResourceType } from '@/types/ApiResources'
import type { CardTemplateType, PrintStudentType } from '@/types/PrintTools'
import type { TeachingSnapshotType } from '@/types/ApiTeaching'
import type { ExamPrintAnalysisType } from '@/types/ExamPrint'
/** 读取服务器教学快照，组织打印与名单核对；不访问旧本地业务 Store。 */
export function useApiPrintTools(
  props: { ownerId: string; workspaceId: string },
  onBusy: (busy: boolean) => void
) {
  const templates = ref<(CardTemplateType & { deletedAt?: number })[]>([]),
    templateId = ref('')
  const snapshot = ref<TeachingSnapshotType | null>(null),
    kind = ref('roster'),
    assessmentId = ref(''),
    selected = ref<string[]>([])
  const settings = ref(createRosterSettings(RosterTemplateEnum.Compact, '')),
    columnText = ref('签名,备注'),
    title = ref('学习之星'),
    body = ref('勤奋努力，表现优异，特发此状，以资鼓励。'),
    baseline = ref('')
  const comparison = ref(''),
    externalBaseline = ref(''),
    external = ref(false),
    result = ref<{ matched: string[]; baselineOnly: string[]; comparisonOnly: string[] } | null>(
      null
    )
  const exporter = useApiPrintExport(
      () => props.ownerId,
      () => props.workspaceId
    ),
    working = ref(false)
  const busy = computed(() => working.value || exporter.busy.value)
  let generation = 0
  const students = computed<PrintStudentType[]>(
    () =>
      snapshot.value?.scores.students
        .filter((row) => !row.disabled && !row.departed)
        .map((row) => ({ id: row.studentId, name: row.name, fields: {} })) || []
  )
  const fingerprint = () =>
    JSON.stringify([
      settings.value,
      columnText.value,
      title.value,
      body.value,
      comparison.value,
      externalBaseline.value
    ])
  const hasDraft = computed(() => fingerprint() !== baseline.value)
  function reset(): void {
    generation++
    settings.value = createRosterSettings(RosterTemplateEnum.Compact, '')
    columnText.value = '签名,备注'
    title.value = '学习之星'
    body.value = '勤奋努力，表现优异，特发此状，以资鼓励。'
    comparison.value = ''
    externalBaseline.value = ''
    result.value = null
    selected.value = []
    baseline.value = fingerprint()
  }
  async function load(): Promise<void> {
    const epoch = generation,
      owner = props.ownerId,
      id = props.workspaceId
    const data = await readTeachingSnapshot(owner, id)
    if (epoch !== generation || owner !== props.ownerId || id !== props.workspaceId) return
    const settingsData = await apiRequest<{ items: ResourceType[] }>('/resources?kind=settings', {
      ownerId: owner
    })
    if (epoch !== generation || owner !== props.ownerId) return
    templates.value = (
      (settingsData.items[0]?.content.templates || []) as (CardTemplateType & {
        deletedAt?: number
      })[]
    ).filter((row) => !row.deletedAt)
    snapshot.value = data
    selected.value = students.value.map((row) => row.id)
    assessmentId.value = data.scores.assessments.find((row) => !row.disabled)?.id || ''
    settings.value.subtitle = `${data.scores.workspace.className} / ${data.scores.workspace.termName}`
    baseline.value = fingerprint()
  }
  async function run(action: () => Promise<void>): Promise<void> {
    if (busy.value) return
    working.value = true
    try {
      await action()
    } catch (error) {
      console.error('打印工具失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      working.value = false
    }
  }
  /** 导出前刷新名单和分数，版式从当前草稿冻结，避免后续编辑改变已经生成的页面。 */
  async function exportPdf(): Promise<void> {
    const owner = props.ownerId,
      id = props.workspaceId,
      epoch = generation,
      data = await readTeachingSnapshot(owner, id)
    if (epoch !== generation) return
    const chosen = new Set(selected.value),
      rows: PrintStudentType[] = data.scores.students
        .filter((row) => !row.disabled && !row.departed && chosen.has(row.studentId))
        .map((row) => ({ id: row.studentId, name: row.name, fields: {} }))
    if (!rows.length) throw new Error('请先选择学生')
    if (kind.value === 'roster') {
      const config = structuredClone({
          ...settings.value,
          columns: columnText.value.split(',').map((text) => text.trim())
        }),
        pages = paginateRoster(rows, config)
      await exporter.run(
        pages.map(
          (page) => () =>
            renderPrintPaperBlob(RosterPaper, { page, settings: config, count: rows.length })
        ),
        config.title,
        pages[0]
      )
    } else if (kind.value === 'exam') {
      const analysis = await apiRequest<ExamPrintAnalysisType>(
        `/workspaces/${id}/exam-print?assessmentId=${assessmentId.value}`,
        { ownerId: owner }
      )
      if (epoch !== generation) return
      const pages = paginateExamPrint(analysis, true),
        label =
          data.scores.assessments.find((row) => row.id === assessmentId.value)?.label || '测评'
      await exporter.run(
        pages.map(
          (page) => () =>
            renderPrintPaperBlob(ExamPaper, {
              page,
              analysis,
              title: `${label}分析表`,
              subtitle: settings.value.subtitle
            })
        ),
        `${label}分析表`,
        { width: 210, height: 297 }
      )
    } else {
      const template = JSON.parse(
          JSON.stringify(
            templates.value.find((row) => row.id === templateId.value) ||
              createCardTemplate(kind.value === 'card' ? 'card' : 'certificate')
          )
        ) as CardTemplateType,
        values = {
          标题: kind.value === 'card' ? '表扬卡' : '奖状',
          称号: title.value,
          正文: body.value,
          班级: data.scores.workspace.className,
          日期: new Date().toISOString().slice(0, 10),
          学校: '',
          落款: ''
        }
      await exporter.run(
        rows.map((row) => async () => {
          const rendered = await renderCardTemplate(template, { ...values, 姓名: row.name })
          try {
            if (rendered.warnings.length) throw new Error(rendered.warnings.join('；'))
            return await printCanvasBlob(rendered.page.canvas)
          } finally {
            rendered.page.canvas.width = 0
          }
        }),
        template.name,
        template
      )
    }
  }
  async function compare(): Promise<void> {
    const names = (text: string) =>
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    const owner = props.ownerId,
      epoch = generation
    const data = await apiRequest<NonNullable<typeof result.value>>(
      `/workspaces/${props.workspaceId}/compare-names`,
      {
        ownerId: owner,
        method: 'POST',
        body: {
          comparison: names(comparison.value),
          ...(external.value ? { baseline: names(externalBaseline.value) } : {})
        }
      }
    )
    if (epoch === generation && owner === props.ownerId) result.value = data
  }
  watch(
    () => [props.ownerId, props.workspaceId],
    () => {
      reset()
      snapshot.value = null
      void run(load)
    },
    { immediate: true }
  )
  watch(busy, onBusy)

  return {
    kind,
    selected,
    settings,
    columnText,
    title,
    body,
    comparison,
    externalBaseline,
    external,
    result,
    busy,
    students,
    hasDraft,
    reset,
    run,
    exportPdf,
    compare,
    assessmentId,
    snapshot,
    templates,
    templateId,
    exporter
  }
}
