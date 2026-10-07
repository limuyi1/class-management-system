<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest, ApiRequestError } from '@/api/client'
import type { ScoreStateType } from '@/types/ApiScores'
import type { AICallResultType } from '@/types/ApiResources'
interface DraftType {
  studentId: string
  name: string
  version: number
  callId: string
  status: string
  text: string
  error: string
}
const props = defineProps<{ ownerId: string; workspaceId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
const state = ref<ScoreStateType | null>(null),
  selected = ref<string[]>([]),
  prompt = ref(''),
  drafts = ref<DraftType[]>([]),
  busy = ref(false),
  stopped = ref(false)
const hasDraft = computed(() => Boolean(prompt.value || drafts.value.length))
let generation = 0,
  currentKey = ''
const keys = new Map<string, string>(),
  saveKeys = new Map<string, string>()
function reset(): void {
  generation++
  drafts.value = []
  prompt.value = ''
  keys.clear()
  saveKeys.clear()
  currentKey = ''
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
  }
}
async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await action()
  } catch (error) {
    console.error('批量评语失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busy.value = false
  }
}
/** 逐人串行，稳定请求键避免重复付费；停止后保留已经生成的草稿。 */
async function generate(): Promise<void> {
  if (!state.value || !selected.value.length || selected.value.length > 50)
    throw new Error('每批请选择 1–50 人')
  const owner = props.ownerId,
    id = props.workspaceId,
    epoch = generation,
    workspaceVersion = state.value.workspace.version
  const snapshot = await apiRequest<{ comments: { studentId: string; version: number }[] }>(
    `/workspaces/${id}/comments`,
    { ownerId: owner }
  )
  if (epoch !== generation || owner !== props.ownerId) return
  stopped.value = false
  for (const studentId of selected.value) {
    if (stopped.value || epoch !== generation || owner !== props.ownerId) break
    const student = state.value.students.find((row) => row.studentId === studentId)
    if (!student || student.disabled || student.departed) continue
    let draft = drafts.value.find((row) => row.studentId === studentId)
    if (draft?.status === 'DONE') continue
    if (!draft) {
      draft = {
        studentId,
        name: student.name,
        version: snapshot.comments.find((row) => row.studentId === studentId)?.version || 0,
        callId: '',
        status: 'RUNNING',
        text: '',
        error: ''
      }
      drafts.value.push(draft)
      draft = drafts.value[drafts.value.length - 1]
    }
    const body = {
        scene: 'comment',
        prompt: prompt.value,
        workspaceId: id,
        workspaceVersion,
        studentId
      },
      fingerprint = JSON.stringify([owner, body])
    if (!keys.has(fingerprint)) keys.set(fingerprint, crypto.randomUUID())
    currentKey = keys.get(fingerprint)!
    try {
      const call = await apiRequest<AICallResultType>('/ai/calls', {
        ownerId: owner,
        method: 'POST',
        body,
        idempotencyKey: currentKey
      })
      if (epoch !== generation || owner !== props.ownerId) return
      draft.callId = call.id
      draft.status = call.status
      draft.text = call.result?.text || ''
      draft.error = ''
      if (call.status !== 'DONE') {
        stopped.value = true
        break
      }
    } catch (error) {
      if (epoch !== generation || owner !== props.ownerId) return
      draft.status = 'UNCERTAIN'
      draft.error = error instanceof Error ? error.message : '生成失败'
      if (
        error instanceof ApiRequestError &&
        error.details &&
        typeof error.details === 'object' &&
        'id' in error.details
      )
        draft.callId = String(error.details.id)
      stopped.value = true
      break
    }
  }
  currentKey = ''
}
async function stop(): Promise<void> {
  stopped.value = true
  if (currentKey)
    await apiRequest('/ai/calls/cancel', {
      ownerId: props.ownerId,
      method: 'POST',
      body: { key: currentKey }
    })
}
async function query(draft: DraftType): Promise<void> {
  if (!draft.callId || draft.status === 'DONE') return
  const owner = props.ownerId,
    epoch = generation
  const call = await apiRequest<AICallResultType>(`/ai/calls/${draft.callId}`, { ownerId: owner })
  if (epoch === generation && owner === props.ownerId) {
    draft.status = call.status
    draft.text = call.result?.text || ''
    draft.error = ''
  }
}
/** 人工审核后一次提交成功项，任何学生版本冲突均整批回滚。 */
async function save(): Promise<void> {
  const items = drafts.value
      .filter((row) => row.status === 'DONE')
      .map((row) => ({ studentId: row.studentId, text: row.text, expectedVersion: row.version })),
    owner = props.ownerId,
    id = props.workspaceId,
    epoch = generation
  if (!items.length || items.some((row) => row.text.length > 5000))
    throw new Error('没有已确认结果或评语超过 5000 字')
  const fingerprint = JSON.stringify([owner, id, items])
  if (!saveKeys.has(fingerprint)) saveKeys.set(fingerprint, crypto.randomUUID())
  await apiRequest(`/workspaces/${id}/comments/batch`, {
    ownerId: owner,
    method: 'PATCH',
    body: { items },
    idempotencyKey: saveKeys.get(fingerprint)
  })
  if (epoch === generation && owner === props.ownerId) {
    drafts.value = drafts.value.filter((row) => row.status !== 'DONE')
    ElMessage.success('已审核评语整批保存成功')
  }
}
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
    <p>最多 50 人逐人生成，使用本人额度。全部内容须审核；版本冲突时整批不覆盖。</p>
    <el-select v-model="selected" multiple filterable :disabled="busy || drafts.length > 0"
      ><el-option
        v-for="row in state?.students.filter((row) => !row.disabled && !row.departed)"
        :key="row.studentId"
        :value="row.studentId"
        :label="row.name" /></el-select
    ><el-input
      v-model="prompt"
      type="textarea"
      :rows="4"
      maxlength="8000"
      placeholder="本批生成要求"
      :disabled="busy || drafts.length > 0"
    /><el-button :loading="busy" @click="run(generate)">生成 / 继续原请求</el-button
    ><el-button v-if="busy" @click="stop().catch((error) => ElMessage.error(error.message))"
      >停止</el-button
    ><el-button :disabled="busy" @click="run(save)">保存已审核的成功项</el-button
    ><el-button :disabled="busy" @click="reset">清除草稿</el-button>
    <article v-for="draft in drafts" :key="draft.studentId">
      <p>{{ draft.name }} · {{ draft.status }} {{ draft.error }}</p>
      <el-input
        v-model="draft.text"
        type="textarea"
        :rows="5"
        :disabled="busy"
        maxlength="5000"
      /><el-button
        v-if="draft.callId && draft.status !== 'DONE'"
        :disabled="busy"
        @click="run(() => query(draft))"
        >查询调用结果</el-button
      >
    </article>
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
