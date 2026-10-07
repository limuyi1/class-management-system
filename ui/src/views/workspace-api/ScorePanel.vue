<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ApiRequestError } from '@/api/client'
import { useApiScores } from '@/hooks/api/useApiScores'
import { buildApiScoreProjection } from '@/utils/apiScoreProjectionUtil'
import AssessmentManager from './AssessmentManager.vue'
import ReferenceManager from './ReferenceManager.vue'
import type { ScoreChangeType, ScoreConflictType } from '@/types/ApiScores'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'

const props = defineProps<{
  ownerId: string
  workspaceId: string
  ownerLabel: string
  catalog: WorkspaceRecordType[]
  active: boolean
}>()
const emit = defineEmits<{
  busy: [value: boolean]
  workspaceUpdated: [value: WorkspaceRecordType]
}>()
const api = useApiScores(
  () => props.ownerId,
  () => props.workspaceId
)
const { state, loading, saving, errorMessage } = api
const manager = ref<InstanceType<typeof AssessmentManager>>()
const references = ref<InstanceType<typeof ReferenceManager>>()
const editingId = ref('')
const drafts = ref<Record<string, string>>({})
const originals = new Map<string, { value: number | null; version: number }>()
const conflicts = ref<ScoreConflictType[]>([])
const page = ref(1)
const showConfiguration = ref(false)
const hasDraft = computed(() =>
  Boolean(editingId.value || manager.value?.hasDraft || references.value?.hasDraft)
)
const blocked = computed(() => saving.value || loading.value)
const projection = computed(() => (state.value ? buildApiScoreProjection(state.value) : null))
const visibleRows = computed(
  () => projection.value?.rows.slice((page.value - 1) * 50, page.value * 50) || []
)
const enabledColumns = computed(
  () => state.value?.assessments.filter((column) => !column.disabled) || []
)
const selectedColumn = computed(() =>
  enabledColumns.value.find((column) => column.id === editingId.value)
)
function reset(): void {
  editingId.value = ''
  drafts.value = {}
  originals.clear()
  conflicts.value = []
  manager.value?.reset()
  references.value?.reset()
}
/** 进入录分时捕获每格版本，不能在后台刷新后悄悄替换 expectedVersion。 */
function begin(): void {
  if (!state.value || !editingId.value) return
  drafts.value = {}
  originals.clear()
  conflicts.value = []
  const byStudent = new Map(
    state.value.scores
      .filter((score) => score.assessmentId === editingId.value)
      .map((score) => [score.studentId, score])
  )
  for (const student of state.value.students) {
    const score = byStudent.get(student.studentId)
    originals.set(student.studentId, { value: score?.value ?? null, version: score?.version ?? 0 })
    drafts.value[student.studentId] =
      score?.value === null || score?.value === undefined ? '' : String(score.value)
  }
}
async function save(): Promise<void> {
  if (!state.value || !editingId.value) return
  const items: ScoreChangeType[] = []
  for (const student of state.value.students) {
    if (student.disabled || student.departed) continue
    const text = drafts.value[student.studentId]?.trim() || ''
    const value = text ? Number(text) : null
    if (value !== null && (!Number.isFinite(value) || Math.abs(value) > 1e9)) {
      ElMessage.error(`${student.name} 的成绩不是有效数值`)
      return
    }
    const original = originals.get(student.studentId)!
    if (value !== original.value)
      items.push({
        studentId: student.studentId,
        assessmentId: editingId.value,
        value,
        expectedVersion: original.version
      })
  }
  if (!items.length) {
    reset()
    return
  }
  try {
    await api.write(`/workspaces/${props.workspaceId}/scores/batch`, 'PATCH', { items })
    reset()
    ElMessage.success('成绩已保存')
  } catch (error) {
    conflicts.value =
      error instanceof ApiRequestError
        ? (error.details as { conflicts?: ScoreConflictType[] } | undefined)?.conflicts || []
        : []
    ElMessage.error(error instanceof Error ? error.message : '保存成绩失败')
    console.error('成绩保存失败:', error)
  }
}
function conflictText(conflict: ScoreConflictType): string {
  const student = state.value?.students.find((row) => row.studentId === conflict.studentId)
  return `${student?.name || '学生'}：服务器最新值 ${conflict.current?.value ?? '未录入'}。当前草稿保留，请取消录入并刷新后核对。`
}
async function refresh(): Promise<void> {
  if (hasDraft.value) {
    ElMessage.warning('请先保存或取消当前编辑再刷新')
    return
  }
  try {
    await api.load()
  } catch (error) {
    console.error('读取成绩失败:', error)
  }
}
/** 焦点恢复刷新跨设备修改；有草稿时只提示，不覆盖尚未提交的值。 */
function focus(): void {
  if (!props.active || blocked.value) return
  if (hasDraft.value)
    ElMessage.info('页面已重新获得焦点；存在未保存编辑，请保存或取消后刷新最新数据')
  else void refresh()
}
watch(
  () => props.active,
  (value) => {
    if (value && state.value) focus()
  }
)
watch(blocked, (value) => emit('busy', value), { immediate: true })
watch(
  () => state.value?.workspace,
  (value) => {
    if (value) emit('workspaceUpdated', value)
  }
)
watch(
  () => [props.ownerId, props.workspaceId],
  () => {
    reset()
    api.clear()
    page.value = 1
    void api.load().catch((error) => console.error('加载成绩失败:', error))
  },
  { immediate: true }
)
onMounted(() => window.addEventListener('focus', focus))
onBeforeUnmount(() => {
  window.removeEventListener('focus', focus)
  emit('busy', false)
})
defineExpose({ hasDraft, reset })
</script>

<template>
  <section v-loading="loading">
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <template v-if="state && projection">
      <div class="score-panel__toolbar">
        <el-select
          v-model="editingId"
          placeholder="选择本期测评开始录分"
          :disabled="blocked || !!editingId || !!manager?.hasDraft || !!references?.hasDraft"
          @change="begin"
          ><el-option
            v-for="column in enabledColumns"
            :key="column.id"
            :value="column.id"
            :label="column.label"
        /></el-select>
        <el-button v-if="editingId" type="primary" :disabled="blocked" @click="save"
          >保存本列修改</el-button
        >
        <el-button v-if="editingId" :disabled="blocked" @click="reset">取消录入</el-button>
        <el-button :disabled="blocked || hasDraft" @click="refresh">刷新</el-button>
        <el-button :disabled="blocked || hasDraft" @click="showConfiguration = !showConfiguration"
          >测评配置</el-button
        >
        <ReferenceManager
          ref="references"
          :state="state"
          :catalog="catalog"
          :owner-id="ownerId"
          :busy="blocked || !!editingId || !!manager?.hasDraft"
          :write="api.write"
        />
      </div>
      <AssessmentManager
        v-if="showConfiguration"
        ref="manager"
        :items="state.assessments"
        :workspace-id="workspaceId"
        :owner-label="ownerLabel"
        :busy="blocked || !!editingId || !!references?.hasDraft"
        :write="api.write"
      />
      <p class="score-panel__hint">
        空白表示未录入，0
        表示零分。历史参照列只读，括号内为来源学期排名；禁用或转出的学生保留原分且不可录入。
      </p>
      <el-alert
        v-for="item in conflicts"
        :key="`${item.studentId}/${item.assessmentId}`"
        :title="conflictText(item)"
        type="warning"
        :closable="false"
      />
      <el-table :data="visibleRows" row-key="studentId" border>
        <el-table-column prop="name" label="姓名" fixed width="120" />
        <el-table-column
          v-if="editingId"
          :label="`录入：${selectedColumn?.label || ''}`"
          fixed
          width="140"
          ><template #default="{ row }"
            ><el-input
              v-model="drafts[row.studentId]"
              :disabled="blocked || row.disabled || row.departed"
              placeholder="未录入" /></template
        ></el-table-column>
        <el-table-column
          v-for="header in projection.headers"
          :key="header.prop"
          :label="`${header.label} / ${header.fullMark}分`"
          :min-width="header.reference ? 240 : 140"
          ><template #default="{ row }"
            >{{ row[header.prop] ?? '—'
            }}<span
              v-if="header.reference && projection.rankByProp.get(header.prop)?.has(row.studentId)"
              >（{{ projection.rankByProp.get(header.prop)?.get(row.studentId) }}名）</span
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :page-size="50"
        :total="projection.rows.length"
        layout="total, prev, pager, next"
      />
      <div class="score-panel__statistics">
        <strong>本期统计（不含历史参照、禁用和转出学生）</strong>
        <p v-for="item in state.statistics" :key="item.assessmentId">
          {{ state.assessments.find((column) => column.id === item.assessmentId)?.label }}：已录
          {{ item.count }}，未录 {{ item.missing }}，平均 {{ item.average ?? '—' }}，最低
          {{ item.min ?? '—' }}，最高 {{ item.max ?? '—' }}
        </p>
      </div>
    </template>
    <el-button v-else-if="!loading" @click="refresh">重新加载成绩</el-button>
  </section>
</template>

<style scoped lang="scss">
.score-panel {
  &__toolbar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    .el-select {
      width: 240px;
    }
  }
  &__hint {
    color: var(--text-secondary);
    font-size: 13px;
    margin: 16px 0;
  }
  &__statistics {
    margin-top: 20px;
    p {
      margin: 8px 0;
    }
  }
}
.el-pagination {
  margin-top: 16px;
}
</style>
