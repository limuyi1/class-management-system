<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { readAssessments } from '@/api/scores'
import type { ReferenceInputType, ScoreStateType } from '@/types/ApiScores'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'

interface ReferenceOptionType extends ReferenceInputType {
  label: string
}
const props = defineProps<{
  state: ScoreStateType
  catalog: WorkspaceRecordType[]
  ownerId: string
  busy: boolean
  write: (path: string, method: string, body: unknown) => Promise<void>
}>()
const opened = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const options = ref<ReferenceOptionType[]>([])
const selected = ref<string[]>([])
const sourceId = ref('')
const known = new Map<string, ReferenceOptionType>()
let sourceVersion = 0
let generation = 0
const hasDraft = computed(() => opened.value)
const sources = computed(() =>
  props.catalog.filter(
    (item) => item.classId === props.state.workspace.classId && item.id !== props.state.workspace.id
  )
)
function reset(): void {
  opened.value = false
  generation++
}
/** 每次只查询所选学期，避免打开设置时并发请求全部历史学期。 */
async function loadSource(id: string): Promise<void> {
  const current = ++generation
  const owner = props.ownerId
  const source = sources.value.find((item) => item.id === id)
  options.value = []
  loading.value = true
  errorMessage.value = ''
  try {
    if (source) {
      const result = await readAssessments(owner, id)
      if (current !== generation || owner !== props.ownerId) return
      options.value = result.items.map((item) => ({
        sourceWorkspaceId: id,
        assessmentId: item.id,
        label: `${source.className} / ${source.termName} / ${item.label}`
      }))
      for (const option of options.value) known.set(option.assessmentId, option)
    }
  } catch (error) {
    if (current === generation)
      errorMessage.value = error instanceof Error ? error.message : '读取参照失败'
  } finally {
    if (current === generation) loading.value = false
  }
}
function open(): void {
  opened.value = true
  selected.value = props.state.references.map((item) => item.assessmentId)
  sourceVersion = props.state.workspace.version
  known.clear()
  for (const item of props.state.references)
    known.set(item.assessmentId, {
      sourceWorkspaceId: item.sourceWorkspaceId,
      assessmentId: item.assessmentId,
      label: item.label
    })
  sourceId.value = sources.value[0]?.id || ''
  void loadSource(sourceId.value)
}
const choices = computed(() => {
  const result = [...options.value]
  for (const id of selected.value) {
    const option = known.get(id)
    if (option && !result.some((item) => item.assessmentId === id)) result.push(option)
  }
  return result
})
async function save(): Promise<void> {
  const items = selected.value
    .map((id) => known.get(id))
    .filter((item): item is ReferenceOptionType => Boolean(item))
    .map((item) => ({ sourceWorkspaceId: item.sourceWorkspaceId, assessmentId: item.assessmentId }))
  if (items.length !== selected.value.length) {
    ElMessage.error('选中的测评已变化，请重新打开参照设置')
    return
  }
  try {
    await props.write(`/workspaces/${props.state.workspace.id}/references`, 'PUT', {
      version: sourceVersion,
      items
    })
    reset()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存参照失败')
    console.error('保存参照失败:', error)
  }
}
onBeforeUnmount(() => {
  generation++
})
defineExpose({ hasDraft, reset })
</script>
<template>
  <el-button :disabled="busy" @click="open">设置历史参照</el-button>
  <el-dialog
    v-model="opened"
    title="历史成绩参照（只读）"
    width="580px"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <p>只能选择本班其他学期。历史成绩不会写入本期，也不会参与本期统计。</p>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-select
      v-model="sourceId"
      :disabled="busy || loading"
      placeholder="选择来源学期"
      @change="loadSource"
      ><el-option
        v-for="item in sources"
        :key="item.id"
        :label="`${item.className} / ${item.termName}`"
        :value="item.id"
    /></el-select>
    <el-select
      v-model="selected"
      multiple
      filterable
      :disabled="busy || loading || !!errorMessage"
      :loading="loading"
      placeholder="选择测评，可跨学期多选"
      ><el-option
        v-for="item in choices"
        :key="item.assessmentId"
        :label="item.label"
        :value="item.assessmentId"
    /></el-select>
    <template #footer
      ><el-button :disabled="busy" @click="reset">取消</el-button
      ><el-button type="primary" :disabled="busy || loading || !!errorMessage" @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>
<style scoped lang="scss">
.el-select {
  width: 100%;
  margin-top: 12px;
}
</style>
