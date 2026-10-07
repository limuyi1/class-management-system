<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import type { ScoreStateType } from '@/types/ApiScores'
const props = defineProps<{ ownerId: string; workspaceId: string }>(),
  emit = defineEmits<{ busy: [boolean]; updated: [] }>()
const state = ref<ScoreStateType | null>(null),
  rows = ref<unknown[][]>([]),
  importId = ref(''),
  busy = ref(false),
  errors = ref<string[]>([]),
  ready = ref(false),
  kind = ref('scores')
const headerRow = ref(0),
  nameColumn = ref(0),
  idColumn = ref<number | null>(null),
  commentColumn = ref<number | null>(null),
  columns = ref<Record<string, number | null>>({})
let generation = 0,
  key = ''
const hasDraft = computed(() => Boolean(importId.value))
const headers = computed(() => rows.value[headerRow.value] || [])
function reset(): void {
  generation++
  rows.value = []
  importId.value = ''
  errors.value = []
  ready.value = false
  columns.value = {}
  key = ''
}
async function load(): Promise<void> {
  const owner = props.ownerId,
    id = props.workspaceId,
    current = generation
  try {
    const data = await apiRequest<ScoreStateType>(`/workspaces/${id}/scores`, { ownerId: owner })
    if (current === generation) state.value = data
  } catch (error) {
    console.error('读取导入配置失败:', error)
  }
}
async function file(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement,
    file = target.files?.[0]
  target.value = ''
  if (!file) return
  if (file.size > 8 * 1024 * 1024) {
    ElMessage.error('Excel 最大 8 MB')
    return
  }
  busy.value = true
  emit('busy', true)
  const current = generation,
    owner = props.ownerId
  try {
    const blob = new Blob([file], {
      type: file.name.toLowerCase().endsWith('.xls')
        ? 'application/vnd.ms-excel'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const data = await apiRequest<{ id: string; rows: unknown[][] }>(
      `/workspaces/${props.workspaceId}/imports/file`,
      { ownerId: owner, method: 'POST', body: blob }
    )
    if (current === generation) {
      rows.value = data.rows
      importId.value = data.id
      ready.value = false
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '读取失败')
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
async function preview(): Promise<void> {
  if (!importId.value) return
  busy.value = true
  emit('busy', true)
  try {
    const result = await apiRequest<{ errors: string[] }>(`/imports/${importId.value}/preview`, {
      ownerId: props.ownerId,
      method: 'POST',
      body: {
        kind: kind.value,
        headerRow: headerRow.value,
        nameColumn: nameColumn.value,
        idColumn: idColumn.value,
        commentColumn: kind.value === 'comments' ? commentColumn.value : null,
        fields:
          kind.value === 'scores'
            ? Object.entries(columns.value)
                .filter(([, column]) => column !== null)
                .map(([assessmentId, column]) => ({ assessmentId, column }))
            : []
      }
    })
    errors.value = result.errors
    ready.value = !errors.value.length
    key = crypto.randomUUID()
  } catch (error) {
    ready.value = false
    ElMessage.error(error instanceof Error ? error.message : '预览失败')
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
async function commit(): Promise<void> {
  if (!ready.value) return
  let committed = false
  busy.value = true
  emit('busy', true)
  try {
    await apiRequest(`/imports/${importId.value}/commit`, {
      ownerId: props.ownerId,
      method: 'POST',
      body: { kind: kind.value },
      idempotencyKey: key
    })
    committed = true
    ElMessage.success('导入已保存')
    reset()
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    busy.value = false
    emit('busy', false)
    if (committed) emit('updated')
  }
}
watch(
  () => [props.ownerId, props.workspaceId],
  () => {
    reset()
    state.value = null
    void load()
  },
  { immediate: true }
)
watch(
  () => [
    headerRow.value,
    nameColumn.value,
    idColumn.value,
    commentColumn.value,
    kind.value,
    JSON.stringify(columns.value)
  ],
  () => {
    ready.value = false
  }
)
defineExpose({ hasDraft, reset })
</script>
<template>
  <section>
    <p>Excel 在服务器解析。先映射列并校验预览，再按捕获版本整批提交；同名学生请使用学生 ID。</p>
    <input type="file" accept=".xlsx,.xls" :disabled="busy" @change="file" />
    <el-form v-if="importId" :disabled="busy" label-width="130px"
      ><el-form-item label="导入类型"
        ><el-radio-group v-model="kind"
          ><el-radio value="scores">成绩</el-radio><el-radio value="roster">学生名单</el-radio
          ><el-radio value="comments">评语</el-radio></el-radio-group
        ></el-form-item
      >
      <el-form-item label="表头行（从 0 起）"
        ><el-input-number v-model="headerRow" :min="0" :max="20"
      /></el-form-item>
      <el-form-item
        v-for="field in [
          { key: 'name', label: '姓名列' },
          { key: 'id', label: '学生 ID 列' },
          { key: 'comment', label: '评语列' }
        ]"
        :key="field.key"
        :label="field.label"
        ><el-select
          :model-value="
            field.key === 'name' ? nameColumn : field.key === 'id' ? idColumn : commentColumn
          "
          clearable
          @update:model-value="
            field.key === 'name'
              ? (nameColumn = Number($event))
              : field.key === 'id'
                ? (idColumn = $event === '' ? null : Number($event))
                : (commentColumn = $event === '' ? null : Number($event))
          "
          ><el-option
            v-for="(header, index) in headers"
            :key="index"
            :value="index"
            :label="`${index + 1}：${header ?? '空列'}`" /></el-select
      ></el-form-item>
      <template v-if="kind === 'scores'"
        ><el-form-item
          v-for="unit in state?.assessments.filter((row) => !row.disabled)"
          :key="unit.id"
          :label="unit.label"
          ><el-select v-model="columns[unit.id]" clearable @clear="columns[unit.id] = null"
            ><el-option
              v-for="(header, index) in headers"
              :key="index"
              :value="index"
              :label="`${index + 1}：${header ?? '空列'}`" /></el-select></el-form-item
      ></template>
      <el-button @click="preview">校验预览</el-button
      ><el-button type="primary" :disabled="!ready" @click="commit">确认提交</el-button
      ><el-button @click="reset">取消导入</el-button></el-form
    >
    <el-alert
      v-for="error in errors.slice(0, 20)"
      :key="error"
      :title="error"
      type="error"
      :closable="false"
    /><el-table :data="rows.slice(headerRow + 1, headerRow + 21)"
      ><el-table-column
        v-for="(header, index) in headers"
        :key="index"
        :label="String(header ?? '空列')"
        ><template #default="{ row }">{{ row[index] }}</template></el-table-column
      ></el-table
    >
  </section>
</template>
