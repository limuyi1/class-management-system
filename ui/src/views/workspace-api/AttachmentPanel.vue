<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AttachmentImageEditor from './AttachmentImageEditor.vue'
import { apiRequest } from '@/api/client'
import { useApiAttachments } from '@/hooks/api/useApiAttachments'
import type { AttachmentType } from '@/types/ApiAttachments'
const props = defineProps<{ ownerId: string; ownerLabel: string; active: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const imageEditor = ref<InstanceType<typeof AttachmentImageEditor>>()
const imageBusy = ref(false)
const moving = ref(false)
const files = ref<HTMLInputElement>()
const state = useApiAttachments(() => props.ownerId)
const {
  items,
  total,
  page,
  loading,
  busy,
  queue,
  hasDraft,
  errorMessage,
  previewUrl,
  previewRecord
} = state
const blocked = computed(() => loading.value || busy.value || imageBusy.value || moving.value)
watch(blocked, (value) => emit('busy', value), { immediate: true })
async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    console.error('素材操作失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}
watch(
  () => props.ownerId,
  () => {
    state.reset()
    void run(state.load)
  },
  { immediate: true }
)
function select(list: File[]): void {
  try {
    state.select(list)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件无效')
  }
}
function change(event: Event): void {
  const input = event.target as HTMLInputElement
  select(Array.from(input.files || []))
  input.value = ''
}
async function rename(record: AttachmentType): Promise<void> {
  const owner = props.ownerId
  try {
    const result = await ElMessageBox.prompt('请输入素材名称', '重命名', {
      inputValue: record.name,
      inputValidator: (value: string) => Boolean(value.trim()) || '名称不能为空'
    })
    if (owner !== props.ownerId) return
    await run(() => state.edit(record, 'PATCH', result.value))
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}
async function remove(record: AttachmentType): Promise<void> {
  const owner = props.ownerId
  try {
    await ElMessageBox.confirm(
      `删除“${record.name}”？将作用于${props.ownerLabel}的账号共用素材库。`,
      '删除素材',
      { type: 'warning' }
    )
  } catch {
    return
  }
  if (owner === props.ownerId) await run(() => state.edit(record, 'DELETE'))
}
async function move(record: AttachmentType, direction: 'up' | 'down'): Promise<void> {
  if (blocked.value) return
  moving.value = true
  const owner = props.ownerId
  try {
    await run(async () => {
      await apiRequest(`/attachments/${record.id}/move`, {
        ownerId: owner,
        method: 'POST',
        body: { version: record.version, direction },
        idempotencyKey: crypto.randomUUID()
      })
      if (owner === props.ownerId) await state.load()
    })
  } finally {
    moving.value = false
  }
}
function focus(): void {
  if (props.active && !blocked.value && !hasDraft.value) void run(state.load)
}
watch(
  () => props.active,
  (value) => {
    if (value) focus()
  }
)
onMounted(() => window.addEventListener('focus', focus))
onBeforeUnmount(() => {
  window.removeEventListener('focus', focus)
  emit('busy', false)
})
defineExpose({ hasDraft, reset: state.reset })
</script>
<template>
  <section
    v-loading="loading"
    @dragover.prevent
    @drop.prevent="select(Array.from($event.dataTransfer?.files || []))"
  >
    <el-alert
      title="账号共用素材库，不随班级或学期变化；支持 PNG/JPEG，单张最大 8 MB，每批最多 10 张。"
      type="info"
      :closable="false"
    />
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <div class="attachment-panel__toolbar">
      <input
        ref="files"
        type="file"
        accept="image/png,image/jpeg"
        multiple
        hidden
        @change="change"
      />
      <el-button :disabled="blocked" @click="files?.click()">选择图片 / 拖入图片</el-button>
      <el-button
        type="primary"
        :disabled="blocked || !queue.length"
        :loading="busy"
        @click="run(state.upload)"
        >上传{{ queue.length ? `（剩余 ${queue.length} 张）` : '' }}</el-button
      >
      <el-button :disabled="blocked || !queue.length" @click="state.select([])"
        >清除待上传</el-button
      >
      <el-button :disabled="blocked" @click="run(state.load)">刷新</el-button>
    </div>
    <p v-if="queue.length">
      待上传：{{ queue.map((file) => file.name).join('、') }}；失败时保留剩余文件，可直接重试。
    </p>
    <AttachmentImageEditor
      ref="imageEditor"
      :owner-id="ownerId"
      @busy="imageBusy = $event"
      @saved="run(state.load)"
    />
    <el-table :data="items" border>
      <el-table-column prop="name" label="素材名称" />
      <el-table-column label="尺寸 / 大小" width="200"
        ><template #default="{ row }"
          >{{ row.width }} × {{ row.height }} · {{ Math.ceil(row.size / 1024) }} KB</template
        ></el-table-column
      >
      <el-table-column label="操作" width="450"
        ><template #default="{ row }">
          <el-button text :disabled="blocked" @click="run(() => state.content(row))"
            >预览</el-button
          >
          <el-button text :disabled="blocked" @click="run(() => state.content(row, true))"
            >下载</el-button
          >
          <el-button text :disabled="blocked" @click="move(row, 'up')">上移</el-button
          ><el-button text :disabled="blocked" @click="move(row, 'down')">下移</el-button>
          <el-button text :disabled="blocked" @click="rename(row)">重命名</el-button>
          <el-button text :disabled="blocked" @click="imageEditor?.open(row)">裁剪/旋转</el-button>
          <el-button text type="danger" :disabled="blocked" @click="remove(row)">删除</el-button>
        </template></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :total="total"
      :page-size="50"
      :disabled="blocked"
      layout="prev, pager, next, total"
      @current-change="run(state.load)"
    />
    <el-dialog
      :model-value="Boolean(previewUrl)"
      :title="previewRecord?.name"
      width="min(900px,90vw)"
      @update:model-value="!$event && state.closePreview()"
    >
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="previewRecord?.name"
        class="attachment-panel__preview"
      />
    </el-dialog>
  </section>
</template>
<style scoped lang="scss">
.attachment-panel {
  &__toolbar {
    display: flex;
    gap: 12px;
    margin: 16px 0;
    flex-wrap: wrap;
  }
  &__preview {
    max-width: 100%;
    max-height: 70vh;
    display: block;
    margin: auto;
  }
}
.el-pagination {
  margin-top: 16px;
}
</style>
