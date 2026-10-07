<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  assertWorkspaceTasksFinished,
  registerWorkspaceLeaveGuard
} from '@/utils/workspaceSessionUtil'
import { hasPendingAccountWrites } from '@/api/client'
import { useRouter } from 'vue-router'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { useAIConfigStore } from '@/stores/ai-config'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { useToolsStore } from '@/stores/tools'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { useWorkspaceStore } from '@/stores/workspace'
import {
  loadServerWorkspace,
  canLeaveServerWorkspace,
  clearServerState,
  serverState,
  flushServerState
} from '@/repositories/v5StateRepository'
const props = defineProps<{ ownerId: string }>()
const router = useRouter()
const ready = ref(false)
const page = ref<{ canLeave?: () => Promise<boolean> }>()
async function canLeave(): Promise<boolean> {
  if (hasPendingAccountWrites()) return false
  try {
    assertWorkspaceTasksFinished()
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '请等待当前任务结束')
    return false
  }
  return (await page.value?.canLeave?.()) !== false && (await canLeaveServerWorkspace())
}
void [
  useDataSourceStore(),
  useSettingStore(),
  useConfigurationStore(),
  useAIConfigStore(),
  useOverviewAnalysisStore(),
  useToolsStore(),
  useScoreNoticeStore(),
  useSeatingChartStore(),
  useDutyRosterStore(),
  useWorkspaceStore()
]
async function load(): Promise<void> {
  ready.value = false
  try {
    await loadServerWorkspace(props.ownerId)
    ready.value = true
    const path = router.currentRoute.value.path
    if (
      path === '/' ||
      path === '/main' ||
      path === '/home' ||
      (['/overview', '/score'].includes(path) && !useDataSourceStore().enabledData.length)
    )
      await router.replace(useDataSourceStore().enabledData.length ? '/overview' : '/tools')
  } catch (error) {
    console.error('读取教学工作台失败:', error)
  }
}
async function save(): Promise<void> {
  try {
    await flushServerState()
    ElMessage.success('已保存到服务器')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  }
}
function beforeUnload(event: BeforeUnloadEvent): void {
  if (serverState.saving || serverState.dirty) {
    event.preventDefault()
    event.returnValue = ''
  }
}
watch(
  () => props.ownerId,
  () => {
    clearServerState()
    void load()
  },
  { immediate: true }
)
const releaseGuard = registerWorkspaceLeaveGuard(canLeave)
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => {
  releaseGuard()
  window.removeEventListener('beforeunload', beforeUnload)
  clearServerState()
})
defineExpose({ canLeave })
</script>
<template>
  <section class="server-teaching-workbench">
    <el-alert v-if="serverState.error" :title="serverState.error" type="error" :closable="false">
      <el-button v-if="serverState.dirty" @click="save">重试保存</el-button
      ><el-button v-else @click="load">重新加载</el-button>
    </el-alert>
    <div v-if="ready" class="server-teaching-workbench__status" role="status">
      <span>{{
        serverState.saving
          ? '正在保存到服务器…'
          : serverState.dirty
            ? '有未保存的修改'
            : '服务器数据已同步'
      }}</span
      ><el-button text :disabled="serverState.saving || !serverState.dirty" @click="save"
        >保存修改</el-button
      >
    </div>
    <div v-if="ready" class="server-teaching-workbench__content">
      <router-view v-slot="{ Component }"
        ><keep-alive
          :key="serverState.workspaceId"
          :include="['OverviewPage', 'ScorePage', 'EvaluationPage']"
          ><component :is="Component" ref="page" /></keep-alive
      ></router-view>
    </div>
    <div v-else-if="!serverState.error" v-loading="true" style="min-height: 200px"></div>
  </section>
</template>
<style scoped lang="scss">
.server-teaching-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  &__content {
    flex: 1;
    min-height: 0;
  }
  &__status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
}
</style>
