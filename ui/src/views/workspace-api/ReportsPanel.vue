<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import { readTeachingSnapshot } from '@/api/teaching'
import { renderApiReportImage } from '@/utils/apiReportImageUtil'
import { createStoredZip } from '@/utils/zipUtil'
import { createBatchImagePdf } from '@/utils/batchImageExportUtil'
import { downloadBlob } from '@/utils/downloadUtil'
import StudentReportPreviewCard from '@/components/student-report/StudentReportPreviewCard.vue'
import type { ScoreStateType } from '@/types/ApiScores'
import type { StudentReportDataType } from '@/types/StudentReport'
import type { ZipEntryType } from '@/utils/zipUtil'
interface ReportRecordType {
  needsReview: boolean
  selectedProps: string[]
  report: StudentReportDataType
  text: string
  version: number
  sourceVersion: string
  workspaceVersion: number
  columns: { prop: string; label: string }[]
}
const props = defineProps<{ ownerId: string; workspaceId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
const state = ref<ScoreStateType | null>(null),
  current = ref<ReportRecordType | null>(null),
  studentId = ref(''),
  selected = ref<string[]>([]),
  range = ref<string[]>([]),
  text = ref(''),
  busy = ref(false),
  stopped = ref(false),
  progress = ref(0)
const hasDraft = computed(() => current.value !== null && text.value !== current.value.text)
let generation = 0
const keys = new Map<string, string>()
function reset(): void {
  generation++
  current.value = null
  text.value = ''
  keys.clear()
  stopped.value = true
}
async function load(): Promise<void> {
  const owner = props.ownerId,
    id = props.workspaceId,
    epoch = generation
  const data = await apiRequest<ScoreStateType>(`/workspaces/${id}/scores`, { ownerId: owner })
  if (epoch === generation && owner === props.ownerId) {
    state.value = data
    selected.value = data.students
      .filter((row) => !row.disabled && !row.departed)
      .slice(0, 50)
      .map((row) => row.studentId)
    studentId.value = selected.value[0] || ''
    range.value = data.assessments.filter((row) => !row.disabled).map((row) => row.prop)
  }
}
async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await action()
  } catch (error) {
    console.error('学习报告操作失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busy.value = false
  }
}
async function preview(): Promise<void> {
  if (hasDraft.value) throw new Error('请先保存或取消正文编辑')
  const owner = props.ownerId,
    epoch = generation
  const data = await apiRequest<ReportRecordType>(
    `/workspaces/${props.workspaceId}/reports/${studentId.value}?props=${encodeURIComponent(range.value.join(','))}`,
    { ownerId: owner }
  )
  if (epoch === generation && owner === props.ownerId) {
    current.value = data
    text.value = data.text
  }
}
/** 保存沿用原报告和成绩版本，网络失败使用同一个幂等键。 */
async function save(): Promise<void> {
  if (!current.value) return
  const owner = props.ownerId,
    id = props.workspaceId,
    epoch = generation
  const body = {
      text: text.value,
      version: current.value.version,
      workspaceVersion: current.value.workspaceVersion,
      sourceVersion: current.value.sourceVersion,
      props: current.value.selectedProps
    },
    fingerprint = JSON.stringify([owner, id, studentId.value, body])
  if (!keys.has(fingerprint)) keys.set(fingerprint, crypto.randomUUID())
  const data = await apiRequest<{ version: number }>(
    `/workspaces/${id}/reports/${studentId.value}`,
    { ownerId: owner, method: 'PUT', body, idempotencyKey: keys.get(fingerprint) }
  )
  if (epoch === generation && owner === props.ownerId) {
    current.value = { ...current.value, text: body.text, version: data.version, needsReview: false }
    ElMessage.success('正文已保存')
  }
}
async function ai(): Promise<void> {
  if (!current.value) throw new Error('请先生成报告预览')
  const owner = props.ownerId,
    epoch = generation,
    body = {
      scene: 'analysis',
      prompt: '生成供教师审核的学习报告正文，避免空泛结论。' + text.value,
      workspaceId: props.workspaceId,
      workspaceVersion: current.value.workspaceVersion,
      studentId: studentId.value
    },
    fingerprint = JSON.stringify([owner, body])
  if (!keys.has(fingerprint)) keys.set(fingerprint, crypto.randomUUID())
  const data = await apiRequest<{ status: string; result: { text: string } | null }>('/ai/calls', {
    ownerId: owner,
    method: 'POST',
    body,
    idempotencyKey: keys.get(fingerprint)
  })
  if (epoch === generation && owner === props.ownerId && data.status === 'DONE' && data.result)
    text.value = data.result.text
}
/** 一批报告在同一服务端事务捕获，长正文由 PDF 分页完整保留。 */
async function exportReports(format: 'pdf' | 'zip'): Promise<void> {
  if (hasDraft.value) throw new Error('请先保存或取消未保存正文')
  const owner = props.ownerId,
    id = props.workspaceId,
    epoch = generation
  const data = await apiRequest<{ items: (ReportRecordType & { studentId: string })[] }>(
    `/workspaces/${id}/reports/preview`,
    { ownerId: owner, method: 'POST', body: { students: selected.value, props: range.value } }
  )
  if (data.items.some((row) => row.needsReview))
    throw new Error('部分报告正文依据旧成绩或旧范围，请逐人预览审核并保存后导出')
  const entries: ZipEntryType[] = []
  stopped.value = false
  progress.value = 0
  for (const row of data.items) {
    if (epoch !== generation || owner !== props.ownerId || stopped.value) break
    entries.push({
      name: `${row.studentId}.png`,
      data: await renderApiReportImage(row.report, row.text)
    })
    progress.value++
  }
  if (!entries.length) return
  const blob =
    format === 'pdf' ? await createBatchImagePdf(entries) : await createStoredZip(entries)
  await readTeachingSnapshot(owner, id)
  if (epoch === generation && owner === props.ownerId)
    downloadBlob(blob, `学习报告${stopped.value ? '-已完成部分' : ''}.${format}`)
}
watch([studentId, () => JSON.stringify(range.value)], () => {
  current.value = null
  text.value = ''
})
watch(
  () => [props.ownerId, props.workspaceId],
  () => {
    reset()
    state.value = null
    void run(load)
  },
  { immediate: true }
)
watch(busy, (value) => emit('busy', value), { immediate: true })
defineExpose({ hasDraft, reset })
</script>
<template>
  <section>
    <el-select v-model="range" multiple :disabled="busy || hasDraft" placeholder="选择分析范围"
      ><el-option
        v-for="unit in state?.assessments.filter((row) => !row.disabled)"
        :key="unit.id"
        :value="unit.prop"
        :label="unit.label" /><el-option
        v-for="unit in state?.references"
        :key="unit.prop"
        :value="unit.prop"
        :label="unit.label"
    /></el-select>
    <el-select v-model="studentId" :disabled="busy || hasDraft" placeholder="预览学生"
      ><el-option
        v-for="row in state?.students.filter((row) => !row.disabled && !row.departed)"
        :key="row.studentId"
        :value="row.studentId"
        :label="row.name" /></el-select
    ><el-button :disabled="busy || !studentId" @click="run(preview)">生成预览</el-button>
    <template v-if="current"
      ><el-input
        v-model="text"
        type="textarea"
        :rows="8"
        :disabled="busy"
        maxlength="20000" /><el-button :disabled="busy" @click="run(save)">保存正文</el-button
      ><el-button :disabled="busy" @click="run(ai)">AI 生成正文</el-button
      ><el-button :disabled="busy" @click="text = current.text">取消正文编辑</el-button
      ><StudentReportPreviewCard :report="current.report" :content="text"
    /></template>
    <el-select
      v-model="selected"
      multiple
      filterable
      :disabled="busy"
      placeholder="批量学生（最多 50 人）"
      ><el-option
        v-for="row in state?.students.filter((row) => !row.disabled && !row.departed)"
        :key="row.studentId"
        :value="row.studentId"
        :label="row.name" /></el-select
    ><el-button
      :disabled="busy || hasDraft || !selected.length"
      @click="run(() => exportReports('pdf'))"
      >批量 PDF</el-button
    ><el-button
      :disabled="busy || hasDraft || !selected.length"
      @click="run(() => exportReports('zip'))"
      >图片 ZIP</el-button
    ><el-button v-if="busy" @click="stopped = true">停止导出</el-button>
    <p v-if="busy">已生成 {{ progress }} 份</p>
  </section>
</template>
<style scoped lang="scss">
section {
  display: grid;
  gap: 12px;
}
.el-select {
  max-width: 720px;
}
</style>
