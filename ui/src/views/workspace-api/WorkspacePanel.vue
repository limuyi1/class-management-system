<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useApiPreferences } from '@/hooks/api/useApiPreferences'
import { useApiWorkspace } from '@/hooks/api/useApiWorkspace'
import WorkspaceToolbar from './WorkspaceToolbar.vue'
import WorkspaceSettingsDialog from './WorkspaceSettingsDialog.vue'
import ScorePanel from './ScorePanel.vue'
import StudentRoster from './StudentRoster.vue'
import type { AccountProfileType } from '@/types/Auth'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'

const AdvancedPanel = defineAsyncComponent(() => import('./AdvancedPanel.vue'))
const advancedPanel = ref<InstanceType<(typeof import('./AdvancedPanel.vue'))['default']>>()
const advancedBusy = ref(false)

const AttachmentPanel = defineAsyncComponent(() => import('./AttachmentPanel.vue'))
const attachmentPanel = ref<InstanceType<(typeof import('./AttachmentPanel.vue'))['default']>>()
const attachmentBusy = ref(false)

const ClassroomToolsPanel = defineAsyncComponent(() => import('./ClassroomToolsPanel.vue'))
const toolsPanel = ref<InstanceType<(typeof import('./ClassroomToolsPanel.vue'))['default']>>()
const toolsBusy = ref(false)

const TeachingPanel = defineAsyncComponent(() => import('./TeachingPanel.vue'))

const props = defineProps<{ user: AccountProfileType; page?: string }>()
const state = useApiWorkspace(props.user.id)
const { ownerId, workspace, catalog, students, loading, loadError } = state
const ownerLabel = computed(() => props.user.nickname)
const { accountStyle, load: loadPreferences } = useApiPreferences(() => ownerId.value)
const busy = ref(false)
const scoreBusy = ref(false)
const teachingBusy = ref(false)
const teachingPanel = ref<InstanceType<(typeof import('./TeachingPanel.vue'))['default']>>()
const workspaceDialog = ref<InstanceType<typeof WorkspaceSettingsDialog>>()
const blocked = computed(
  () =>
    advancedBusy.value ||
    busy.value ||
    scoreBusy.value ||
    teachingBusy.value ||
    toolsBusy.value ||
    attachmentBusy.value
)
const businessTab = ref(props.page || 'home')
watch(
  () => props.page,
  (value) => {
    if (value) businessTab.value = value
  }
)
const AnalysisPanel = defineAsyncComponent(() => import('./AnalysisPanel.vue'))
watch(businessTab, () => void loadPreferences())
const scorePanel = ref<InstanceType<typeof ScorePanel>>()
const roster = ref<InstanceType<typeof StudentRoster>>()
const selectedId = computed(() => workspace.value?.id || '')
const keys = new Map<string, string>()

/** 操作内容相同保留幂等键，避免响应丢失后重试产生重复名单或学期。 */
async function mutate(path: string, method: string, body: unknown): Promise<void> {
  const fingerprint = JSON.stringify([ownerId.value, path, method, body])
  let key = keys.get(fingerprint)
  if (!key) {
    key = crypto.randomUUID()
    keys.set(fingerprint, key)
  }
  busy.value = true
  try {
    const result = await state.write<{ id?: string }>(path, method, body, key)
    await state.loadCatalog(result?.id || workspace.value?.id)
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
    throw error
  } finally {
    busy.value = false
  }
}
/** 离开账号或学期必须先处理草稿；正在提交时阻止切换。 */
async function canLeave(): Promise<boolean> {
  if (blocked.value) {
    ElMessage.warning('请等待提交完成')
    return false
  }
  if (
    !roster.value?.hasDraft &&
    !scorePanel.value?.hasDraft &&
    !workspaceDialog.value?.hasDraft &&
    !teachingPanel.value?.hasDraft &&
    !toolsPanel.value?.hasDraft &&
    !attachmentPanel.value?.hasDraft &&
    !advancedPanel.value?.hasDraft
  )
    return true
  try {
    await ElMessageBox.confirm('当前有未保存的编辑，确认放弃并切换？', '未保存的修改', {
      type: 'warning'
    })
    roster.value?.reset()
    scorePanel.value?.reset()
    workspaceDialog.value?.reset()
    teachingPanel.value?.reset()
    toolsPanel.value?.reset()
    attachmentPanel.value?.reset()
    advancedPanel.value?.reset()
    return true
  } catch {
    return false
  }
}
async function removeWorkspace(wholeClass: boolean): Promise<void> {
  if (!workspace.value || !(await canLeave())) return
  const current = workspace.value
  try {
    await ElMessageBox.confirm(
      `将软删除「${ownerLabel.value} / ${current.className}」${wholeClass ? '的全部学期' : current.termName}，数据仍保留。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  if (current.id !== workspace.value?.id) return
  try {
    await mutate(`/workspaces/${current.id}`, 'DELETE', { version: current.version, wholeClass })
  } catch (error) {
    console.error('删除学期失败:', error)
  }
}
async function changePeriod(id: string): Promise<void> {
  if (id === selectedId.value || !(await canLeave())) return
  try {
    await state.loadPeriod(id)
  } catch (error) {
    console.error('切换学期失败:', error)
  }
}
async function openDialog(value: 'create' | 'edit' | 'promote'): Promise<void> {
  if (await canLeave()) workspaceDialog.value?.open(value, workspace.value)
}
async function refresh(): Promise<void> {
  if (!(await canLeave())) return
  try {
    await state.loadCatalog()
  } catch (error) {
    console.error('刷新名单失败:', error)
  }
}
/** 成绩变化同步目录版本，升学期必须使用最新目录版本。 */
function updateScoreWorkspace(value: WorkspaceRecordType): void {
  if (value.ownerId !== ownerId.value || value.id !== workspace.value?.id) return
  workspace.value = value
  catalog.value = catalog.value.map((item) => (item.id === value.id ? value : item))
}
function beforeUnload(event: BeforeUnloadEvent): void {
  if (
    blocked.value ||
    roster.value?.hasDraft ||
    scorePanel.value?.hasDraft ||
    workspaceDialog.value?.hasDraft ||
    teachingPanel.value?.hasDraft ||
    toolsPanel.value?.hasDraft ||
    attachmentPanel.value?.hasDraft ||
    advancedPanel.value?.hasDraft
  ) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void state.loadCatalog().catch((error) => console.error('加载班级失败:', error))
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
defineExpose({ canLeave })
</script>

<template>
  <div v-loading="loading" :style="accountStyle">
    <WorkspaceToolbar
      :user="user"
      :owner-id="ownerId"
      :selected-id="selectedId"
      :catalog="catalog"
      :has-workspace="Boolean(workspace)"
      :disabled="blocked || loading"
      @period="changePeriod"
      @dialog="openDialog"
      @refresh="refresh"
      @remove="removeWorkspace"
    />
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <el-tabs
      v-if="workspace"
      v-model="businessTab"
      :before-leave="canLeave"
      :class="{ 'workspace-panel__pages': page }"
    >
      <el-tab-pane label="教学总览" name="home" lazy>
        <div class="workspace-panel__overview">
          <strong>{{ workspace.className }} · {{ workspace.termName }}</strong>
          <span
            >学生 {{ students.filter((item) => !item.disabled && !item.departed).length }} 人</span
          >
        </div>
        <AnalysisPanel
          :owner-id="ownerId"
          :workspace-id="workspace.id"
          @busy="advancedBusy = $event"
        />
      </el-tab-pane>
      <el-tab-pane label="学生名单" name="students" lazy>
        <StudentRoster
          ref="roster"
          :workspace="workspace"
          :students="students"
          :catalog="catalog"
          :owner-label="ownerLabel"
          :busy="blocked || loading"
          :mutate="mutate"
        />
      </el-tab-pane>
      <el-tab-pane label="成绩与历史参照" name="scores" lazy>
        <ScorePanel
          ref="scorePanel"
          :owner-id="ownerId"
          :workspace-id="workspace.id"
          :owner-label="ownerLabel"
          :catalog="catalog"
          :active="businessTab === 'scores'"
          @busy="scoreBusy = $event"
          @workspace-updated="updateScoreWorkspace"
        />
      </el-tab-pane>
      <el-tab-pane label="评语与成绩通知" name="teaching" lazy>
        <TeachingPanel
          ref="teachingPanel"
          :owner-id="ownerId"
          :workspace-id="workspace.id"
          :owner-label="ownerLabel"
          :active="businessTab === 'teaching'"
          @busy="teachingBusy = $event"
          @workspace-updated="updateScoreWorkspace"
        />
      </el-tab-pane>
      <el-tab-pane label="座位表与值日表" name="tools" lazy>
        <ClassroomToolsPanel
          ref="toolsPanel"
          :owner-id="ownerId"
          :workspace-id="workspace.id"
          :owner-label="ownerLabel"
          :active="businessTab === 'tools'"
          @busy="toolsBusy = $event"
          @workspace-updated="updateScoreWorkspace"
        />
      </el-tab-pane>
      <el-tab-pane label="分析、导入与高级工具" name="advanced" lazy
        ><AdvancedPanel
          ref="advancedPanel"
          :owner-id="ownerId"
          :workspace-id="workspace.id"
          @busy="advancedBusy = $event"
          @updated="refresh"
      /></el-tab-pane>
      <el-tab-pane label="账号共用素材" name="attachments" lazy>
        <AttachmentPanel
          ref="attachmentPanel"
          :owner-id="ownerId"
          :owner-label="ownerLabel"
          :active="businessTab === 'attachments'"
          @busy="attachmentBusy = $event"
        />
      </el-tab-pane>
    </el-tabs>
    <el-empty v-else-if="!loading && !loadError" description="暂无班级学期，请先创建" />
    <AttachmentPanel
      v-if="!workspace && !loading && !loadError && businessTab === 'attachments'"
      ref="attachmentPanel"
      :owner-id="ownerId"
      :owner-label="ownerLabel"
      :active="true"
      @busy="attachmentBusy = $event"
    />
    <WorkspaceSettingsDialog ref="workspaceDialog" :busy="blocked" :mutate="mutate" />
  </div>
</template>

<style scoped lang="scss">
.workspace-panel {
  &__pages :deep(> .el-tabs__header) {
    display: none;
  }
  &__overview {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 24px;
    color: var(--text-primary);
  }
  &__notice {
    margin-bottom: 16px;
  }
}
</style>
