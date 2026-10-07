<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useClassroomToolExport } from '@/hooks/api/useClassroomToolExport'
import { useClassroomTools } from '@/hooks/api/useClassroomTools'
import { reconcileClassroomTool } from '@/utils/apiClassroomToolUtil'
import ApiSeatingEditor from './ApiSeatingEditor.vue'
import ApiDutyEditor from './ApiDutyEditor.vue'
import ClassroomToolsCatalog from './ClassroomToolsCatalog.vue'
import type { SeatingChartType } from '@/types/SeatingChart'
import type { DutyRosterType } from '@/types/DutyRoster'
import type { ExcelStudentSourceType } from '@/types/StudentSource'
import type { ClassroomToolRecordType, ClassroomToolKindType } from '@/types/ApiClassroomTools'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'

const SeatingExport = defineAsyncComponent(
  () => import('@/views/seating-chart/components/SeatingChartExportDialog.vue')
)
const DutyExport = defineAsyncComponent(
  () => import('@/views/duty-roster/components/DutyRosterExportDialog.vue')
)
const ExcelImport = defineAsyncComponent(
  () => import('@/components/student-source/ExcelStudentRosterDialog.vue')
)
const ExcelSourceImport = defineAsyncComponent(
  () => import('@/views/seating-chart/components/SeatingStudentImportDialog.vue')
)
const props = defineProps<{
  ownerId: string
  workspaceId: string
  ownerLabel: string
  active: boolean
}>()
const emit = defineEmits<{
  busy: [value: boolean]
  workspaceUpdated: [value: WorkspaceRecordType]
}>()
const tools = useClassroomTools(
  () => props.ownerId,
  () => props.workspaceId
)
const { state, draft, students, hasDraft: contentHasDraft, loading, saving, errorMessage } = tools
const seatingEditor = ref<InstanceType<typeof ApiSeatingEditor>>()
const hasDraft = computed(
  () =>
    contentHasDraft.value ||
    importVisible.value ||
    rosterVisible.value ||
    Boolean(seatingEditor.value?.hasDraft)
)
const importVisible = ref(false)
const rosterVisible = ref(false)
const exporting = useClassroomToolExport(
  () => props.ownerId,
  () => props.workspaceId
)
const { visible: exportVisible, record: exportRecord, names: exportNames } = exporting
const exportBusy = ref(false)
const scopeKey = computed(() => `${props.ownerId}:${props.workspaceId}`)
const blocked = computed(() => loading.value || saving.value || exportBusy.value)
const chart = computed(() => (draft.value && 'seats' in draft.value ? draft.value : null))
const roster = computed(() => (draft.value && 'sections' in draft.value ? draft.value : null))
watch(blocked, (value) => emit('busy', value), { immediate: true })
watch(
  () => state.value?.workspace,
  (value) => {
    if (value) emit('workspaceUpdated', value)
  }
)
/** 父页面离开、关闭代管时同步清空草稿和导出快照。 */
function reset(): void {
  tools.reset()
  exporting.reset()
  exportBusy.value = false
  importVisible.value = false
  rosterVisible.value = false
}
async function load(): Promise<void> {
  try {
    await tools.load()
  } catch (error) {
    console.error('读取工具方案失败:', error)
  }
}
watch(
  scopeKey,
  () => {
    reset()
    tools.clear()
    void load()
  },
  { immediate: true }
)
async function discard(): Promise<boolean> {
  if (!hasDraft.value) return true
  try {
    await ElMessageBox.confirm('当前方案有未保存的修改，确认放弃？', '未保存的修改', {
      type: 'warning'
    })
    return true
  } catch {
    return false
  }
}
async function create(value: ClassroomToolKindType): Promise<void> {
  if (await discard()) tools.create(value)
}
async function edit(record: ClassroomToolRecordType): Promise<void> {
  if (await discard()) tools.edit(record)
}
async function copy(record: ClassroomToolRecordType): Promise<void> {
  if (await discard()) tools.copy(record)
}
async function save(): Promise<void> {
  try {
    await tools.save()
    ElMessage.success('方案已保存到服务器')
  } catch (error) {
    console.error('保存方案失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  }
}
async function remove(record: ClassroomToolRecordType): Promise<void> {
  if (!(await discard())) return
  try {
    await ElMessageBox.confirm(
      `删除“${record.content.name}”？将作用于${props.ownerLabel}的当前班级学期。`,
      '删除方案',
      { type: 'warning' }
    )
    await tools.write(`/workspaces/${props.workspaceId}/tools/${record.id}`, 'DELETE', {
      version: record.version
    })
    tools.reset()
    ElMessage.success('方案已软删除')
  } catch (error) {
    if (error instanceof Error) {
      console.error('删除方案失败:', error)
      ElMessage.error(error.message)
    }
  }
}
function importSource(source: ExcelStudentSourceType): void {
  if (!draft.value) return
  draft.value.studentSource = 'excel'
  draft.value.excelSource = source
  reconcileClassroomTool(draft.value, students.value)
}
async function useSystem(): Promise<void> {
  if (!draft.value || draft.value.studentSource === 'system') return
  try {
    await ElMessageBox.confirm('切换为本期系统名单会清理不在名单中的安排，继续？', '更换名单', {
      type: 'warning'
    })
  } catch {
    return
  }
  draft.value.studentSource = 'system'
  delete draft.value.excelSource
  reconcileClassroomTool(draft.value, students.value)
}
function addStudent(name: string): void {
  draft.value?.excelSource?.students.push({ id: crypto.randomUUID(), name })
}
function removeStudent(student: { id: string }): void {
  if (!draft.value?.excelSource) return
  draft.value.excelSource.students = draft.value.excelSource.students.filter(
    (row) => row.id !== student.id
  )
  reconcileClassroomTool(draft.value, students.value)
}
/** 草稿必须先保存，导出读取服务器新快照。 */
async function openExport(): Promise<void> {
  if (!draft.value || hasDraft.value) {
    ElMessage.warning('请先保存方案再导出')
    return
  }
  try {
    await exporting.open(draft.value.id)
  } catch (error) {
    console.error('读取导出方案失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  }
}
function focus(): void {
  if (props.active && !hasDraft.value && !blocked.value && !exportVisible.value) void load()
}
watch(
  () => props.active,
  (active) => {
    if (active) focus()
  }
)
onMounted(() => window.addEventListener('focus', focus))
onBeforeUnmount(() => {
  window.removeEventListener('focus', focus)
  emit('busy', false)
})
defineExpose({ hasDraft, reset })
</script>

<template>
  <div v-loading="loading">
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <div class="tools-panel__toolbar">
      <el-button :disabled="blocked" @click="create('seating')">新建座位表</el-button>
      <el-button :disabled="blocked" @click="create('duty')">新建值日表</el-button>
      <el-button :disabled="blocked || hasDraft" @click="load">刷新方案</el-button>
      <span>{{ ownerLabel }} · 当前班级 / 学期</span>
    </div>
    <ClassroomToolsCatalog
      :tools="state?.tools || []"
      :disabled="blocked"
      @edit="edit"
      @copy="copy"
      @remove="remove"
    />
    <fieldset
      v-if="draft"
      :disabled="blocked || exportVisible"
      :inert="blocked || exportVisible"
      class="tools-panel__editor"
    >
      <div class="tools-panel__toolbar">
        <el-input v-model="draft.name" maxlength="120" placeholder="方案名称" />
        <el-button type="primary" :loading="saving" @click="save">保存方案</el-button>
        <el-button :disabled="hasDraft || !tools.expectedVersion.value" @click="openExport"
          >打印 / 导出</el-button
        >
        <el-tag :type="hasDraft ? 'warning' : 'success'">{{
          hasDraft ? '草稿未保存' : '已保存'
        }}</el-tag>
      </div>
      <div class="tools-panel__toolbar">
        <el-button @click="useSystem">使用本期系统名单</el-button>
        <el-button @click="importVisible = true">导入临时 Excel 名单</el-button>
        <el-button v-if="draft.studentSource === 'excel'" @click="rosterVisible = true"
          >管理临时名单</el-button
        >
        <span
          >{{ draft.studentSource === 'system' ? '本期系统名单' : draft.excelSource?.fileName }} ·
          {{ students.length }} 人</span
        >
      </div>
      <ApiSeatingEditor
        ref="seatingEditor"
        v-if="chart"
        :key="`${chart.id}:${tools.expectedVersion.value}`"
        :chart="chart"
        :students="students"
        @update:chart="draft = $event"
      />
      <ApiDutyEditor
        v-if="roster"
        :key="`${roster.id}:${tools.expectedVersion.value}`"
        :roster="roster"
        :students="students"
        @update:roster="draft = $event"
      />
      <p>备注说明</p>
      <el-input v-model="draft.notes" type="textarea" :rows="4" maxlength="5000" show-word-limit />
    </fieldset>
    <ExcelSourceImport :key="scopeKey" v-model="importVisible" @confirm="importSource" />
    <ExcelImport
      v-if="draft?.excelSource"
      v-model="rosterVisible"
      scope-label="当前工具方案"
      :students="draft.excelSource.students"
      :assigned-student-ids="students.map((student) => student.id)"
      @add="addStudent"
      @remove="removeStudent"
    />
    <SeatingExport
      v-if="exportRecord?.kind === 'seating'"
      v-model="exportVisible"
      :chart="exportRecord.content as SeatingChartType"
      :student-names="exportNames"
      :authorize-export="exporting.authorize"
      @busy="exportBusy = $event"
    />
    <DutyExport
      v-if="exportRecord?.kind === 'duty'"
      v-model="exportVisible"
      :roster="exportRecord.content as DutyRosterType"
      :student-names="exportNames"
      :authorize-export="exporting.authorize"
      @busy="exportBusy = $event"
    />
  </div>
</template>

<style scoped lang="scss">
.tools-panel {
  &__toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    margin: 16px 0;
    .el-input {
      width: 260px;
    }
  }
  &__editor {
    border: 0;
    padding: 0;
    min-width: 0;
  }
}
</style>
