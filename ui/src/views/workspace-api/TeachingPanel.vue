<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { readTeachingSnapshot } from '@/api/teaching'
import { useScopedApiResource } from '@/hooks/api/useScopedApiResource'
import { useTeachingExport } from '@/hooks/api/useTeachingExport'
import { buildNoticeProjection } from '@/utils/apiTeachingProjectionUtil'
import ScoreNoticePreview from '@/views/score-notice/components/ScoreNoticePreview.vue'
import CommentEditor from './CommentEditor.vue'
import NoticeSettings from './NoticeSettings.vue'
import LegacyNoticePanel from './LegacyNoticePanel.vue'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'

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
const api = useScopedApiResource(
  () => props.ownerId,
  () => props.workspaceId,
  readTeachingSnapshot
)
const { state, loading, saving, errorMessage } = api
const editor = ref<InstanceType<typeof CommentEditor>>()
const settings = ref<InstanceType<typeof NoticeSettings>>()
const exportPreview = ref<InstanceType<typeof ScoreNoticePreview>>()
const output = useTeachingExport(
  () => props.ownerId,
  () => props.workspaceId,
  exportPreview
)
const { exporting, processed, total, context, student: exportStudent } = output
const legacyBusy = ref(false)
const tab = ref('comments')
const selectedId = ref('')
const page = ref(1)
const hasDraft = computed(() => Boolean(editor.value?.hasDraft || settings.value?.hasDraft))
const blocked = computed(() => loading.value || saving.value || exporting.value || legacyBusy.value)
const preview = computed(() => {
  if (!state.value) return null
  try {
    return buildNoticeProjection(state.value)
  } catch {
    return null
  }
})
const selected = computed(
  () =>
    preview.value?.students.find((item) => item.id === selectedId.value) ||
    preview.value?.students[0] ||
    null
)
const batch = computed(
  () => preview.value?.students.slice((page.value - 1) * 50, page.value * 50) || []
)
function reset(): void {
  editor.value?.reset()
  settings.value?.reset()
}
async function refresh(): Promise<void> {
  if (hasDraft.value || blocked.value) return
  try {
    await api.load()
  } catch (error) {
    console.error('加载教学数据失败:', error)
  }
}
async function exportFile(kind: Parameters<typeof output.run>[0], single = false): Promise<void> {
  if (hasDraft.value) {
    ElMessage.warning('请先保存或取消当前编辑')
    return
  }
  try {
    await output.run(
      kind,
      single && selected.value ? [selected.value.id] : batch.value.map((item) => item.id)
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
    console.error('导出教学文件失败:', error)
  }
}
function beforeLeave(): boolean {
  if (blocked.value || hasDraft.value) {
    ElMessage.warning('请先完成或取消当前操作')
    return false
  }
  return true
}
function focus(): void {
  if (!props.active || blocked.value) return
  if (hasDraft.value) ElMessage.info('存在未保存编辑，请保存或取消后刷新最新教学数据')
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
  () => state.value?.scores.workspace,
  (value) => {
    if (value) emit('workspaceUpdated', value)
  }
)
watch(
  () => [props.ownerId, props.workspaceId],
  () => {
    reset()
    api.clear()
    selectedId.value = ''
    page.value = 1
    void api.load().catch((error) => console.error('读取教学数据失败:', error))
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
    <div class="teaching-panel__toolbar">
      <el-button :disabled="blocked || hasDraft" @click="refresh">刷新</el-button
      ><el-button :disabled="blocked || hasDraft" @click="exportFile('scores')"
        >导出本期成绩 Excel</el-button
      ><el-button :disabled="blocked || hasDraft" @click="exportFile('comments')"
        >导出评语 Excel</el-button
      >
    </div>
    <el-tabs v-if="state" v-model="tab" :before-leave="beforeLeave">
      <el-tab-pane label="学生评语" name="comments"
        ><CommentEditor
          ref="editor"
          :snapshot="state"
          :busy="blocked"
          :owner-label="ownerLabel"
          :write="api.write"
      /></el-tab-pane>
      <el-tab-pane label="成绩通知单" name="notice" lazy>
        <div class="teaching-panel__toolbar">
          <NoticeSettings
            ref="settings"
            :snapshot="state"
            :busy="blocked"
            :write="api.write"
          /><el-select
            v-model="selectedId"
            :disabled="blocked || hasDraft"
            placeholder="选择预览学生"
            ><el-option
              v-for="item in preview?.students || []"
              :key="item.id"
              :value="item.id"
              :label="`${item.name}（${item.id.slice(-6)}）`" /></el-select
          ><el-button :disabled="blocked || hasDraft || !selected" @click="exportFile('png', true)"
            >当前 PNG</el-button
          ><el-button :disabled="blocked || hasDraft || !selected" @click="exportFile('pdf', true)"
            >当前 PDF</el-button
          ><el-button :disabled="blocked || hasDraft || !batch.length" @click="exportFile('pdf')"
            >本批 PDF</el-button
          ><el-button :disabled="blocked || hasDraft || !batch.length" @click="exportFile('zip')"
            >本批图片 ZIP</el-button
          >
        </div>
        <p>
          通知使用最新已保存的本期成绩与评语，历史参照不进入通知。每批最多 50 人，PDF 每人独立 A4
          横向页面，可下载后打印。
        </p>
        <el-pagination
          v-if="preview"
          v-model:current-page="page"
          :page-size="50"
          :total="preview.students.length"
          :disabled="blocked"
          layout="total, prev, pager, next"
        />
        <div v-if="exporting">
          已生成 {{ processed }} / {{ total }} 份
          <el-button @click="output.stop">停止并下载已完成部分</el-button>
        </div>
        <el-alert
          v-if="!preview"
          title="通知配置含失效测评，请打开通知设置调整科目"
          type="warning"
          :closable="false"
        />
        <el-empty v-if="preview && !selected" description="本期没有有效学生，请先检查名单" />
        <el-scrollbar class="app-scroll-region" max-height="650px" v-if="preview && selected"
          ><div class="teaching-panel__preview">
            <ScoreNoticePreview
              empty-comment="暂未填写评语"
              :title="preview.config.title"
              :notice-date="preview.config.noticeDate"
              :mode="preview.mode"
              :subjects="preview.subjects"
              :student="selected"
            /></div
        ></el-scrollbar>
      </el-tab-pane>
      <el-tab-pane label="历史成绩通知单" name="legacy-notice" lazy>
        <LegacyNoticePanel
          :owner-id="ownerId"
          :workspace-id="workspaceId"
          @busy="legacyBusy = $event"
        />
      </el-tab-pane>
    </el-tabs>
    <div v-if="context && exportStudent" class="teaching-panel__export" aria-hidden="true">
      <ScoreNoticePreview
        ref="exportPreview"
        empty-comment="暂未填写评语"
        :title="context.config.title"
        :notice-date="context.config.noticeDate"
        :mode="context.mode"
        :subjects="context.subjects"
        :student="exportStudent"
      />
    </div>
  </section>
</template>
<style scoped lang="scss">
.teaching-panel {
  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    .el-select {
      width: 240px;
    }
  }
  &__preview {
    overflow: visible;

    margin-top: 16px;
  }
  &__export {
    position: fixed;
    left: -20000px;
    top: 0;
    width: 1448px;
    pointer-events: none;
  }
}
</style>
