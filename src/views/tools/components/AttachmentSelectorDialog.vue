<script setup lang="ts">
/** 素材选择对话框 — 从素材库挑选图片加入试卷排版 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { attachmentToObjectUrl, getAttachments } from '@/views/tools/services/attachmentService'
import type { AttachmentRecordType } from '@/types/Tools'

interface AttachmentViewType extends AttachmentRecordType {
  url: string
}

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  confirm: [attachments: AttachmentRecordType[]]
  addAttachments: []
}>()

const attachments = ref<AttachmentViewType[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)

const selectedAttachments = computed(() => {
  return selectedIds.value
    .map((id) => attachments.value.find((attachment) => attachment.id === id))
    .filter((attachment): attachment is AttachmentViewType => attachment !== undefined)
})

onBeforeUnmount(() => {
  revokeUrls()
})

watch(
  visible,
  async (nextVisible) => {
    if (!nextVisible) return
    await loadAttachments()
  },
  { immediate: true }
)

function revokeUrls(): void {
  attachments.value.forEach((attachment) => {
    URL.revokeObjectURL(attachment.url)
  })
}

/** 为素材记录补充预览 URL */
function toViewRecord(record: AttachmentRecordType): AttachmentViewType {
  return {
    ...record,
    url: attachmentToObjectUrl(record)
  }
}

async function loadAttachments(): Promise<void> {
  loading.value = true
  try {
    const records = await getAttachments()
    revokeUrls()
    attachments.value = records.map(toViewRecord)
  } finally {
    loading.value = false
  }
}

/** 切换某张素材的选中状态 */
function toggleSelect(id: string): void {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}

/** 关闭弹窗并清空选择 */
function handleClose(): void {
  selectedIds.value = []
  visible.value = false
}

/** 确认加入排版：向外抛出选中的素材记录 */
function handleConfirm(): void {
  emit('confirm', selectedAttachments.value)
  selectedIds.value = []
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" title="从素材库选择" width="900px" :close-on-click-modal="false">
    <div v-loading="loading" class="attachment-selector">
      <div v-if="attachments.length === 0" class="selector-empty">
        <font-awesome-icon :icon="['solid', 'images']" />
        <span>素材库还没有图片，可先去素材库保存长期复用素材</span>
        <el-button type="primary" size="small" @click="emit('addAttachments')">
          <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
          去素材库添加
        </el-button>
      </div>

      <div v-else class="selector-grid">
        <button
          v-for="attachment in attachments"
          :key="attachment.id"
          class="selector-card"
          type="button"
          :class="{ selected: selectedIds.includes(attachment.id) }"
          @click="toggleSelect(attachment.id)"
        >
          <span class="selector-card__image-wrap">
            <span class="selector-card__backdrop"></span>
            <img :src="attachment.url" :alt="attachment.name" />
            <span class="selector-card__overlay">点击选择</span>
          </span>
          <span class="selector-card__name">{{ attachment.name }}</span>
          <font-awesome-icon class="check-icon" :icon="['solid', 'circle-check']" />
        </button>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :disabled="selectedIds.length === 0" @click="handleConfirm">
        加入排版
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.attachment-selector {
  min-height: 360px;
}

.selector-empty {
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: #9ca3af;
  border: 1px dashed #d7e1ec;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.86) 0%, rgba(255, 255, 255, 0.96) 100%);
}

.selector-empty svg {
  font-size: 28px;
}

.selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
  max-height: 58vh;
  overflow: auto;
  padding: 2px;
}

.selector-card {
  position: relative;
  min-width: 0;
  padding: 10px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, #ffffff 100%), #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
  cursor: pointer;
  text-align: left;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.selector-card:hover {
  transform: translateY(-2px);
  border-color: #d7e3f0;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.1);
}

.selector-card.selected {
  border-color: color-mix(in srgb, var(--theme-menu-active) 42%, #bfd6fb);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-menu-active) 6%, #ffffff) 0%,
      #ffffff 100%
    ),
    #fff;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--theme-menu-active) 16%, #eef4ff),
    0 16px 30px rgba(15, 23, 42, 0.08);
}

.selector-card__image-wrap {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(135deg, #f7f9fc 0%, #eef3f9 100%);
}

.selector-card__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.88), transparent 32%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(226, 232, 240, 0.16));
}

.selector-card img {
  position: relative;
  z-index: 1;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: contain;
  transition:
    transform 0.22s ease,
    filter 0.22s ease;
}

.selector-card__overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0.42) 100%);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  opacity: 0;
  transition: opacity 0.22s ease;
}

.selector-card:hover img {
  transform: scale(1.03);
  filter: saturate(1.04);
}

.selector-card:hover .selector-card__overlay {
  opacity: 1;
}

.selector-card__name {
  display: block;
  overflow: hidden;
  margin-top: 10px;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.check-icon {
  position: absolute;
  top: 14px;
  right: 14px;
  color: var(--theme-menu-active);
  opacity: 0;
  font-size: 18px;
  transition: opacity 0.18s ease;
}

.selector-card.selected .check-icon {
  opacity: 1;
}
</style>
