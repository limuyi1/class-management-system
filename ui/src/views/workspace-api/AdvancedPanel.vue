<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { ElMessage } from 'element-plus'
const props = defineProps<{ ownerId: string; workspaceId: string }>(),
  emit = defineEmits<{ busy: [boolean]; updated: [] }>()
const AICommentBatchPanel = defineAsyncComponent(() => import('./AICommentBatchPanel.vue'))
const batchComments = ref<EditorType>()
const CardTemplatesPanel = defineAsyncComponent(() => import('./CardTemplatesPanel.vue'))
const cards = ref<EditorType>()
const ReportsPanel = defineAsyncComponent(() => import('./ReportsPanel.vue'))
const reports = ref<EditorType>()
const PrintToolsPanel = defineAsyncComponent(() => import('./PrintToolsPanel.vue'))
const print = ref<EditorType>()
const AnalysisPanel = defineAsyncComponent(() => import('./AnalysisPanel.vue')),
  ImportPanel = defineAsyncComponent(() => import('./ImportPanel.vue')),
  TagsPanel = defineAsyncComponent(() => import('./TagsPanel.vue')),
  AIWorkspacePanel = defineAsyncComponent(() => import('./AIWorkspacePanel.vue')),
  PaperPanel = defineAsyncComponent(() => import('./PaperPanel.vue')),
  AccountBusinessSettings = defineAsyncComponent(() => import('./AccountBusinessSettings.vue'))
const tab = ref('analysis')
const busyStates = ref<Record<string, boolean>>({})
const busy = computed(() => Object.values(busyStates.value).some(Boolean))
interface EditorType {
  hasDraft: boolean
  reset: () => void
}
const imports = ref<EditorType>(),
  tags = ref<EditorType>(),
  ai = ref<EditorType>(),
  paper = ref<EditorType>(),
  settings = ref<EditorType>()
const editors = () => [
  batchComments.value,
  cards.value,
  reports.value,
  print.value,
  imports.value,
  tags.value,
  ai.value,
  paper.value,
  settings.value
]
const hasDraft = computed(() => editors().some((editor) => editor?.hasDraft))
function reset(): void {
  editors().forEach((editor) => editor?.reset())
}
function beforeLeave(): boolean {
  if (busy.value || hasDraft.value) {
    ElMessage.warning('请先保存或取消当前编辑')
    return false
  }
  return true
}
function activity(name: string, value: boolean): void {
  busyStates.value = { ...busyStates.value, [name]: value }
  emit('busy', busy.value)
}
defineExpose({ hasDraft, reset })
</script>
<template>
  <el-tabs v-model="tab" :before-leave="beforeLeave">
    <el-tab-pane label="统计与趋势" name="analysis" lazy
      ><AnalysisPanel
        :owner-id="props.ownerId"
        :workspace-id="props.workspaceId"
        @busy="activity('AnalysisPanel', $event)"
    /></el-tab-pane>
    <el-tab-pane label="Excel 导入" name="imports" lazy
      ><ImportPanel
        ref="imports"
        :owner-id="props.ownerId"
        :workspace-id="props.workspaceId"
        @busy="activity('ImportPanel', $event)"
        @updated="emit('updated')"
    /></el-tab-pane>
    <el-tab-pane label="评语标签" name="tags" lazy
      ><TagsPanel
        ref="tags"
        :owner-id="props.ownerId"
        :workspace-id="props.workspaceId"
        @busy="activity('TagsPanel', $event)"
    /></el-tab-pane>
    <el-tab-pane label="AI 生成与识别" name="ai" lazy
      ><AIWorkspacePanel
        ref="ai"
        :owner-id="props.ownerId"
        :workspace-id="props.workspaceId"
        @busy="activity('AIWorkspacePanel', $event)"
    /></el-tab-pane>
    <el-tab-pane label="试卷排版" name="paper" lazy
      ><PaperPanel ref="paper" :owner-id="props.ownerId" @busy="activity('PaperPanel', $event)"
    /></el-tab-pane>
    <el-tab-pane label="账号版式设置" name="settings" lazy
      ><AccountBusinessSettings
        ref="settings"
        :owner-id="props.ownerId"
        @busy="activity('AccountBusinessSettings', $event)"
    /></el-tab-pane>
    <el-tab-pane label="打印与名单核对" name="print" lazy
      ><PrintToolsPanel
        ref="print"
        :owner-id="props.ownerId"
        :workspace-id="props.workspaceId"
        @busy="activity('PrintToolsPanel', $event)"
    /></el-tab-pane>
    <el-tab-pane label="批量学习报告" name="reports" lazy
      ><ReportsPanel
        ref="reports"
        :owner-id="props.ownerId"
        :workspace-id="props.workspaceId"
        @busy="activity('ReportsPanel', $event)"
    /></el-tab-pane>
    <el-tab-pane label="奖状卡片模板" name="cards" lazy
      ><CardTemplatesPanel
        ref="cards"
        :owner-id="props.ownerId"
        @busy="activity('CardTemplatesPanel', $event)"
    /></el-tab-pane>
    <el-tab-pane label="AI 批量评语" name="batch-comments" lazy
      ><AICommentBatchPanel
        ref="batchComments"
        :owner-id="props.ownerId"
        :workspace-id="props.workspaceId"
        @busy="activity('AICommentBatchPanel', $event)"
    /></el-tab-pane>
  </el-tabs>
</template>
