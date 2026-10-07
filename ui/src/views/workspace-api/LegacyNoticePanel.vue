<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import { downloadBlob, sanitizeExportFileName } from '@/utils/downloadUtil'
import { renderScoreNoticeBlob } from '@/utils/score-notice/scoreNoticeImageUtil'
import { createScoreNoticePdf } from '@/utils/score-notice/scoreNoticePdfUtil'
import ScoreNoticePreview from '@/views/score-notice/components/ScoreNoticePreview.vue'
import type { ScoreNoticeStateType } from '@/types/ScoreNotice'
const props = defineProps<{ ownerId: string; workspaceId: string }>()
const emit = defineEmits<{ busy: [boolean] }>()
const notice = ref<ScoreNoticeStateType | null>(null),
  selectedId = ref(''),
  busy = ref(false)
const preview = ref<InstanceType<typeof ScoreNoticePreview>>()
const selected = computed(
  () =>
    notice.value?.students.find((row) => row.id === selectedId.value) ||
    notice.value?.students[0] ||
    null
)
let epoch = 0,
  alive = true
/** 档案按账号与学期读取，旧请求晚响应不进入新账号视图。 */
async function load(): Promise<void> {
  const owner = props.ownerId,
    id = props.workspaceId,
    current = ++epoch
  notice.value = null
  try {
    const data = await apiRequest<{ notice: ScoreNoticeStateType | null }>(
      `/workspaces/${id}/legacy-notice`,
      { ownerId: owner }
    )
    if (alive && current === epoch && owner === props.ownerId && id === props.workspaceId) {
      notice.value = data.notice
      selectedId.value = data.notice?.students[0]?.id || ''
    }
  } catch (error) {
    if (alive && current === epoch)
      ElMessage.error(error instanceof Error ? error.message : '读取历史通知失败')
  }
}
/** 导出保持旧通知独立的五科成绩与评语；完成渲染后再次鉴权。 */
async function exportFile(kind: 'png' | 'pdf'): Promise<void> {
  if (busy.value || !selected.value || !notice.value) return
  const owner = props.ownerId,
    id = props.workspaceId,
    current = epoch,
    name = selected.value.name
  busy.value = true
  emit('busy', true)
  try {
    await nextTick()
    const element = preview.value?.getElement()
    if (!element) throw new Error('请等待预览完成')
    const image = await renderScoreNoticeBlob(element)
    const blob =
      kind === 'pdf' ? await createScoreNoticePdf([{ name: 'notice.png', data: image }]) : image
    await apiRequest(`/workspaces/${id}/legacy-notice`, { ownerId: owner })
    if (alive && current === epoch && owner === props.ownerId && id === props.workspaceId)
      downloadBlob(blob, `${sanitizeExportFileName(name, '学生')}_历史成绩通知.${kind}`)
  } catch (error) {
    console.error('导出历史通知失败:', error)
    if (alive && current === epoch)
      ElMessage.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
watch(
  () => [props.ownerId, props.workspaceId],
  () => void load(),
  { immediate: true }
)
onBeforeUnmount(() => {
  alive = false
  epoch++
  emit('busy', false)
})
</script>
<template>
  <section>
    <p>旧版通知的独立成绩、等级和评语已完整保留。这里查看原稿，不影响本期成绩与评语。</p>
    <el-empty v-if="!notice?.students.length" description="本学期没有历史成绩通知" />
    <template v-else>
      <el-select v-model="selectedId" filterable :disabled="busy">
        <el-option v-for="row in notice.students" :key="row.id" :label="row.name" :value="row.id" />
      </el-select>
      <el-button :disabled="busy" @click="exportFile('png')">当前 PNG</el-button>
      <el-button :disabled="busy" @click="exportFile('pdf')">当前 PDF</el-button>
      <p>共 {{ notice.students.length }} 名学生 · {{ notice.sourceFileName }}</p>
      <el-scrollbar class="app-scroll-region" max-height="650px"
        ><div class="legacy-notice__preview">
          <ScoreNoticePreview
            ref="preview"
            :title="notice.title"
            :notice-date="notice.noticeDate"
            :mode="notice.mode"
            :subjects="notice.subjects"
            :student="selected"
          /></div
      ></el-scrollbar>
    </template>
  </section>
</template>
<style scoped lang="scss">
.legacy-notice__preview {
  overflow: visible;

  margin-top: 16px;
}
</style>
