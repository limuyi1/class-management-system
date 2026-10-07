<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest, ApiRequestError } from '@/api/client'
import type { ScoreStateType } from '@/types/ApiScores'
import type { AttachmentType } from '@/types/ApiAttachments'
import type { AICallResultType } from '@/types/ApiResources'
const props = defineProps<{ ownerId: string; workspaceId: string }>()
const emit = defineEmits<{ busy: [boolean] }>()
const state = ref<ScoreStateType | null>(null),
  studentId = ref(''),
  scene = ref('comment'),
  prompt = ref(''),
  result = ref<AICallResultType | null>(null),
  busy = ref(false)
const commentVersions = ref<Record<string, number>>({})
const generatedStudent = ref('')
const generatedScene = ref('')
const generatedVersion = ref(0)
const attachments = ref<AttachmentType[]>([]),
  attachmentId = ref('')
let generation = 0,
  pending: { fingerprint: string; key: string } | undefined
const writeKeys = new Map<string, string>()
const scorePreviews = new Map<string, { id: string; key: string }>()
const hasDraft = computed(() => Boolean(prompt.value || result.value))
function reset(): void {
  generation++
  prompt.value = ''
  result.value = null
  generatedStudent.value = ''
  studentId.value = ''
  attachmentId.value = ''
  pending = undefined
  writeKeys.clear()
  scorePreviews.clear()
}
async function load(): Promise<void> {
  const current = generation,
    owner = props.ownerId,
    id = props.workspaceId
  try {
    const [scores, files, comments] = await Promise.all([
      apiRequest<ScoreStateType>(`/workspaces/${id}/scores`, { ownerId: owner }),
      apiRequest<{ items: AttachmentType[] }>('/attachments', { ownerId: owner }),
      apiRequest<{ comments: { studentId: string; version: number }[] }>(
        `/workspaces/${id}/comments`,
        { ownerId: owner }
      )
    ])
    if (current === generation && owner === props.ownerId && id === props.workspaceId) {
      commentVersions.value = Object.fromEntries(
        comments.comments.map((row) => [row.studentId, row.version])
      )
      state.value = scores
      attachments.value = files.items
    }
  } catch (error) {
    console.error('读取 AI 数据失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '读取失败')
  }
}
/** 生成先审核，写回仍按学生版本检查；不自动覆盖评语或识别成绩。 */
async function run(): Promise<void> {
  if (!state.value || busy.value) return
  const owner = props.ownerId,
    current = generation
  const file = attachments.value.find((row) => row.id === attachmentId.value)
  const body = {
    scene: scene.value,
    prompt: prompt.value,
    workspaceId: props.workspaceId,
    workspaceVersion: state.value.workspace.version,
    ...(studentId.value ? { studentId: studentId.value } : {}),
    ...(file ? { attachmentId: file.id, attachmentVersion: file.version } : {})
  }
  const fingerprint = JSON.stringify([owner, body])
  if (pending?.fingerprint !== fingerprint) {
    generatedScene.value = scene.value
    generatedStudent.value = studentId.value
    generatedVersion.value = commentVersions.value[studentId.value] || 0
  }
  if (pending?.fingerprint !== fingerprint) pending = { fingerprint, key: crypto.randomUUID() }
  busy.value = true
  emit('busy', true)
  try {
    const data = await apiRequest<AICallResultType>('/ai/calls', {
      method: 'POST',
      ownerId: owner,
      body,
      idempotencyKey: pending.key
    })
    if (current === generation && owner === props.ownerId) result.value = data
  } catch (error) {
    console.error('AI 生成失败:', error)
    if (
      current === generation &&
      owner === props.ownerId &&
      error instanceof ApiRequestError &&
      error.details &&
      typeof error.details === 'object' &&
      'id' in error.details
    ) {
      result.value = { id: String(error.details.id), status: 'UNCERTAIN', result: null }
    }
    ElMessage.error(error instanceof Error ? error.message : '生成失败')
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
async function cancel(): Promise<void> {
  if (!pending) return
  try {
    await apiRequest('/ai/calls/cancel', {
      ownerId: props.ownerId,
      method: 'POST',
      body: { key: pending.key }
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '取消失败')
  }
}
async function query(): Promise<void> {
  if (!result.value || result.value.status === 'DONE') return
  const owner = props.ownerId,
    current = generation,
    id = result.value.id
  try {
    const data = await apiRequest<AICallResultType>(`/ai/calls/${id}`, { ownerId: owner })
    if (current === generation && owner === props.ownerId && result.value?.id === id)
      result.value = data
  } catch (error) {
    if (current === generation) ElMessage.error(error instanceof Error ? error.message : '查询失败')
  }
}
async function applyComment(): Promise<void> {
  if (!result.value?.result || !generatedStudent.value || busy.value) return
  busy.value = true
  emit('busy', true)
  const owner = props.ownerId,
    id = props.workspaceId,
    current = generation
  try {
    if (current !== generation || owner !== props.ownerId) return
    const body = {
      items: [
        {
          studentId: generatedStudent.value,
          text: result.value.result.text,
          expectedVersion: generatedVersion.value
        }
      ]
    }
    const fingerprint = JSON.stringify([owner, id, body])
    if (!writeKeys.has(fingerprint)) writeKeys.set(fingerprint, crypto.randomUUID())
    await apiRequest(`/workspaces/${id}/comments/batch`, {
      method: 'PATCH',
      ownerId: owner,
      idempotencyKey: writeKeys.get(fingerprint),
      body
    })
    if (current !== generation || owner !== props.ownerId) return
    ElMessage.success('评语已保存')
    result.value = null
    await load()
  } catch (error) {
    console.error('保存 AI 评语失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
/** 识别 JSON 经人工编辑审核后，服务端生成带原版本的导入预览。 */
async function applyScores(): Promise<void> {
  if (!result.value?.result || busy.value) return
  const owner = props.ownerId,
    current = generation,
    callId = result.value.id
  busy.value = true
  emit('busy', true)
  try {
    const text = result.value.result.text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    const items: unknown = JSON.parse(text)
    if (!Array.isArray(items)) throw new Error('识别结果须为 JSON 数组，请先审核修改')
    const fingerprint = JSON.stringify([owner, callId, items])
    let saved = scorePreviews.get(fingerprint)
    if (!saved) {
      const preview = await apiRequest<{ id: string; errors: string[] }>(
        `/ai/calls/${callId}/score-preview`,
        { ownerId: owner, method: 'POST', body: { items } }
      )
      if (current !== generation || owner !== props.ownerId) return
      if (preview.errors.length) throw new Error(preview.errors.join('；'))
      saved = { id: preview.id, key: crypto.randomUUID() }
      scorePreviews.set(fingerprint, saved)
    }
    await apiRequest(`/imports/${saved.id}/commit`, {
      ownerId: owner,
      method: 'POST',
      body: { kind: 'scores' },
      idempotencyKey: saved.key
    })
    if (current !== generation || owner !== props.ownerId) return
    ElMessage.success('审核成绩已保存')
    result.value = null
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
watch(
  () => [props.ownerId, props.workspaceId],
  () => {
    reset()
    state.value = null
    attachments.value = []
    void load()
  },
  { immediate: true }
)
defineExpose({ hasDraft, reset })
</script>
<template>
  <section>
    <p>使用当前用户的 AI 配置与额度，生成结果须人工审核。</p>
    <el-select v-model="scene" :disabled="busy"
      ><el-option
        v-for="option in [
          { id: 'comment', name: '生成评语' },
          { id: 'polish', name: '润色评语' },
          { id: 'tags', name: '生成标签建议' },
          { id: 'analysis', name: '学情分析' },
          { id: 'recognize', name: '图片识别成绩' }
        ]"
        :key="option.id"
        :value="option.id"
        :label="option.name"
    /></el-select>
    <el-select v-model="studentId" clearable :disabled="busy" placeholder="选择学生；留空分析全班"
      ><el-option
        v-for="row in state?.students"
        :key="row.studentId"
        :value="row.studentId"
        :label="row.name"
    /></el-select>
    <el-select
      v-if="scene === 'recognize'"
      v-model="attachmentId"
      :disabled="busy"
      placeholder="选择成绩图片"
      ><el-option v-for="row in attachments" :key="row.id" :value="row.id" :label="row.name"
    /></el-select>
    <el-input
      v-model="prompt"
      :disabled="busy"
      type="textarea"
      :rows="5"
      maxlength="8000"
      placeholder="填写生成要求或需要润色的原文"
    />
    <el-button :loading="busy" @click="run">生成 / 使用原请求重试</el-button
    ><el-button v-if="busy" @click="cancel">取消生成（用量需核对）</el-button
    ><el-button :disabled="busy" @click="reset">清除草稿</el-button
    ><el-button :disabled="busy" @click="load">刷新数据</el-button>
    <template v-if="result"
      ><p>调用状态：{{ result.status }}</p>
      <el-button v-if="result.status !== 'DONE'" :disabled="busy" @click="query"
        >查询调用结果</el-button
      ><el-input
        v-if="result.result"
        v-model="result.result.text"
        :disabled="busy"
        type="textarea"
        :rows="12"
      /><el-button
        v-if="studentId && result.result && ['comment', 'polish'].includes(generatedScene)"
        :disabled="busy"
        @click="applyComment"
        >审核后保存为该学生评语</el-button
      ><el-button
        v-if="result.status === 'DONE' && generatedScene === 'recognize'"
        :disabled="busy"
        @click="applyScores"
        >审核后保存识别成绩</el-button
      ></template
    >
  </section>
</template>
