import { nextTick, onScopeDispose, ref } from 'vue'
import { apiRequest } from '@/api/client'
import { readTeachingSnapshot } from '@/api/teaching'
import { buildNoticeProjection } from '@/utils/apiTeachingProjectionUtil'
import { downloadBlob, sanitizeExportFileName } from '@/utils/downloadUtil'
import { renderScoreNoticeBlob } from '@/utils/score-notice/scoreNoticeImageUtil'
import { createScoreNoticePdf } from '@/utils/score-notice/scoreNoticePdfUtil'
import { createStoredZip } from '@/utils/zipUtil'
import type { Ref } from 'vue'
import type { ScoreNoticeStudentType } from '@/types/ScoreNotice'

interface PreviewExposeType {
  getElement: () => HTMLElement | null
}
/** 导出只读取最新已授权快照，使用离屏预览，不改变老师当前选择或编辑草稿。 */
export function useTeachingExport(
  owner: () => string,
  workspace: () => string,
  preview: Ref<PreviewExposeType | undefined>
) {
  const exporting = ref(false)
  const stopped = ref(false)
  const processed = ref(0)
  const total = ref(0)
  const context = ref<ReturnType<typeof buildNoticeProjection> | null>(null)
  const student = ref<ScoreNoticeStudentType | null>(null)
  let alive = true
  let generation = 0
  function stop(): void {
    stopped.value = true
  }
  async function run(
    kind: 'scores' | 'comments' | 'png' | 'pdf' | 'zip',
    ids: string[] = []
  ): Promise<void> {
    if (exporting.value) return
    const scope = { owner: owner(), workspace: workspace(), generation: ++generation }
    exporting.value = true
    stopped.value = false
    processed.value = 0
    try {
      // 深拷贝后，后续自动刷新、预览选中或后台修改不会改变这一批的内容。
      const snapshot = await readTeachingSnapshot(scope.owner, scope.workspace)
      if (
        !alive ||
        scope.generation !== generation ||
        scope.owner !== owner() ||
        scope.workspace !== workspace()
      )
        return
      const prefix = sanitizeExportFileName(
        `${snapshot.scores.workspace.className}_${snapshot.scores.workspace.termName}`,
        '班级成绩'
      )
      if (kind === 'scores' || kind === 'comments') {
        const blob = await apiRequest<Blob>(
          `/workspaces/${scope.workspace}/export?kind=${kind}&format=xlsx`,
          { ownerId: scope.owner, responseType: 'blob' }
        )
        if (!alive || scope.owner !== owner() || scope.workspace !== workspace()) return
        await readTeachingSnapshot(scope.owner, scope.workspace)
        if (!alive || scope.owner !== owner() || scope.workspace !== workspace()) return
        await downloadBlob(blob, `${prefix}_${kind === 'comments' ? '评语' : '成绩'}.xlsx`)
        return
      }
      const projection = buildNoticeProjection(snapshot)
      if (!projection.subjects.length) throw new Error('请先选择本期通知测评')
      const chosen = new Set(ids)
      const students = projection.students.filter((item) => chosen.has(item.id))
      if (!students.length) throw new Error('没有可导出的有效学生，请刷新名单')
      if (students.length > 50 || (kind === 'png' && students.length !== 1))
        throw new Error('通知单每批最多 50 人，PNG 请选择单人')
      if (
        projection.config.mode === 'grade' &&
        students.some((item) =>
          projection.subjects.some(
            (subject) =>
              item.rawValues[subject.id] !== null && item.gradeValues[subject.id] === null
          )
        )
      )
        throw new Error('部分分数超出等级规则范围，请调整规则或改用分数模式')
      context.value = projection
      total.value = students.length
      const entries: Array<{ name: string; data: Blob }> = []
      for (const [index, item] of students.entries()) {
        if (!alive || stopped.value || scope.owner !== owner() || scope.workspace !== workspace())
          break
        student.value = item
        await nextTick()
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
        const element = preview.value?.getElement()
        if (!element) throw new Error('通知预览尚未就绪')
        const blob = await renderScoreNoticeBlob(element, 1.5)
        if (!alive) return
        entries.push({
          name: `${index + 1}_${sanitizeExportFileName(item.name, '学生')}_${item.id}.png`,
          data: blob
        })
        processed.value = index + 1
      }
      if (!alive || !entries.length || scope.owner !== owner() || scope.workspace !== workspace())
        return
      const suffix = stopped.value ? `_已完成${entries.length}份` : ''
      if (kind === 'png') await downloadBlob(entries[0].data, `${prefix}_${entries[0].name}`)
      else {
        const blob =
          kind === 'pdf' ? await createScoreNoticePdf(entries) : await createStoredZip(entries)
        if (!alive || scope.owner !== owner() || scope.workspace !== workspace()) return
        await downloadBlob(blob, `${prefix}_成绩通知${suffix}.${kind}`)
      }
    } finally {
      exporting.value = false
      context.value = null
      student.value = null
    }
  }
  onScopeDispose(() => {
    alive = false
    generation++
    stopped.value = true
  })
  return { exporting, stopped, processed, total, context, student, run, stop }
}
