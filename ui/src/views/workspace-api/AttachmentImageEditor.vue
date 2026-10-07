<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ImageCropper from '@/components/ImageCropper.vue'
import { apiRequest } from '@/api/client'
import { base64ToBlob } from '@/utils/fileUtil'
import type { AttachmentType } from '@/types/ApiAttachments'
const props = defineProps<{ ownerId: string }>(),
  emit = defineEmits<{ busy: [boolean]; saved: [] }>()
const visible = ref(false),
  imageSrc = ref(''),
  record = ref<AttachmentType | null>(null),
  saving = ref(false)
let generation = 0,
  key = '',
  fingerprint = ''
function close(): void {
  generation++
  visible.value = false
  record.value = null
  if (imageSrc.value) URL.revokeObjectURL(imageSrc.value)
  imageSrc.value = ''
  emit('busy', false)
}
async function open(row: AttachmentType): Promise<void> {
  close()
  const owner = props.ownerId,
    current = generation
  emit('busy', true)
  try {
    const blob = await apiRequest<Blob>(`/attachments/${row.id}/content?version=${row.version}`, {
      ownerId: owner,
      responseType: 'blob'
    })
    if (current !== generation || owner !== props.ownerId) return
    record.value = row
    imageSrc.value = URL.createObjectURL(blob)
    visible.value = true
    key = crypto.randomUUID()
    fingerprint = ''
  } catch (error) {
    close()
    ElMessage.error(error instanceof Error ? error.message : '读取图片失败')
  }
}
/** 编辑结果二进制提交，保留素材 ID，旧文件快照仍可供排版使用。 */
async function save(base64: string): Promise<void> {
  if (!record.value) return
  const owner = props.ownerId,
    current = generation,
    row = record.value
  saving.value = true
  try {
    if (fingerprint !== base64) {
      fingerprint = base64
      key = crypto.randomUUID()
    }
    const blob = base64ToBlob(base64, 'image/png')
    await apiRequest(`/attachments/${row.id}`, {
      ownerId: owner,
      method: 'PUT',
      body: blob,
      fileName: row.name,
      expectedVersion: row.version,
      idempotencyKey: key
    })
    if (current === generation && owner === props.ownerId) {
      close()
      emit('saved')
    }
  } catch (error) {
    visible.value = true
    ElMessage.error(error instanceof Error ? error.message : '保存图片失败')
  } finally {
    saving.value = false
  }
}
watch(() => props.ownerId, close)
onBeforeUnmount(close)
defineExpose({ open })
</script>
<template>
  <ImageCropper
    v-model:visible="visible"
    :image-src="imageSrc"
    output-type="png"
    @confirm="save"
    @cancel="close"
  />
  <p v-if="saving">正在保存图片…</p>
</template>
