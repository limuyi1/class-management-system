<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'

import ImageCropper from '@/components/ImageCropper.vue'
import PageHeader from '@/components/PageHeader.vue'
import {
  addFilesToAttachments,
  attachmentToObjectUrl,
  deleteAttachment,
  getAttachments,
  renameAttachment,
  updateAttachmentOrder,
  updateAttachmentFromCroppedBase64
} from '@/views/tools/services/attachmentService'
import type { AttachmentRecordType } from '@/types/Tools'

interface AttachmentViewType extends AttachmentRecordType {
  url: string
}

const router = useRouter()
const fileInputRef = ref<HTMLInputElement | null>(null)
const attachments = ref<AttachmentViewType[]>([])
const loading = ref(false)
const uploading = ref(false)
const cropperVisible = ref(false)
const cropperImageSrc = ref('')
const editingAttachment = ref<AttachmentViewType | null>(null)
const previewAttachment = ref<AttachmentViewType | null>(null)
const previewVisible = ref(false)
const selectedIds = ref<string[]>([])

const attachmentCountText = computed(() => {
  return attachments.value.length === 0 ? '暂无图片素材' : `共 ${attachments.value.length} 张图片`
})

const selectedCount = computed(() => selectedIds.value.length)
const attachmentHintText = computed(() => {
  return selectedCount.value > 0
    ? `${attachmentCountText.value} · 已选 ${selectedCount.value} 张`
    : attachmentCountText.value
})
const attachmentPanelClass = computed(() => ({
  'has-selection': selectedCount.value > 0
}))
const cropperOutputType = computed<'jpeg' | 'png'>(() => {
  return editingAttachment.value?.mimeType === 'image/png' ? 'png' : 'jpeg'
})

loadAttachments()

onBeforeUnmount(() => {
  revokeAttachmentUrls()
})

function backToTools(): void {
  router.push('/tools')
}

function revokeAttachmentUrls(): void {
  attachments.value.forEach((attachment) => {
    URL.revokeObjectURL(attachment.url)
  })
}

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
    revokeAttachmentUrls()
    attachments.value = records.map(toViewRecord)
  } finally {
    loading.value = false
  }
}

function toggleSelect(id: string): void {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}

function selectAll(): void {
  selectedIds.value = attachments.value.map((attachment) => attachment.id)
}

function clearSelection(): void {
  selectedIds.value = []
}

async function handleSortEnd(): Promise<void> {
  try {
    await updateAttachmentOrder(attachments.value.map((attachment) => attachment.id))
  } catch (error) {
    console.error('保存附件顺序失败:', error)
    ElMessage.error('保存排序失败')
    await loadAttachments()
  }
}

function handleUploadClick(): void {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''
  await uploadFiles(files)
}

async function handleDrop(event: DragEvent): Promise<void> {
  const files = Array.from(event.dataTransfer?.files || [])
  await uploadFiles(files)
}

async function uploadFiles(files: File[]): Promise<void> {
  if (files.length === 0) return

  uploading.value = true
  try {
    const records = await addFilesToAttachments(files)
    if (records.length === 0) {
      ElMessage.warning('请选择图片文件')
      return
    }
    ElMessage.success(`已上传 ${records.length} 张图片`)
    await loadAttachments()
  } catch (error) {
    console.error('上传附件失败:', error)
    ElMessage.error('上传失败')
  } finally {
    uploading.value = false
  }
}

async function handleRename(attachment: AttachmentViewType): Promise<void> {
  try {
    const result = await ElMessageBox.prompt('请输入附件名称', '重命名附件', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: attachment.name,
      inputValidator: (value) => value.trim().length > 0,
      inputErrorMessage: '名称不能为空'
    })
    await renameAttachment(attachment.id, result.value.trim())
    await loadAttachments()
  } catch {
    // 用户取消时不提示
  }
}

async function handleDelete(attachment: AttachmentViewType): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除「${attachment.name}」？`, '删除附件', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteAttachment(attachment.id)
    selectedIds.value = selectedIds.value.filter((item) => item !== attachment.id)
    await loadAttachments()
  } catch {
    // 用户取消时不提示
  }
}

async function handleBatchDelete(): Promise<void> {
  if (selectedIds.value.length === 0) return

  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 个附件？`, '批量删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    for (const id of selectedIds.value) {
      await deleteAttachment(id)
    }
    selectedIds.value = []
    await loadAttachments()
    ElMessage.success('已删除选中附件')
  } catch {
    // 用户取消时不提示
  }
}

function openCropper(attachment: AttachmentViewType): void {
  editingAttachment.value = attachment
  cropperImageSrc.value = attachment.url
  cropperVisible.value = true
}

function openPreview(attachment: AttachmentViewType): void {
  previewAttachment.value = attachment
  previewVisible.value = true
}

function getAttachmentOrientationLabel(attachment: AttachmentViewType): string {
  return attachment.width >= attachment.height ? '横向' : '纵向'
}

async function handleCropConfirm(base64: string): Promise<void> {
  if (!editingAttachment.value) return

  try {
    await updateAttachmentFromCroppedBase64(editingAttachment.value, base64)
    ElMessage.success('裁剪已保存')
    await loadAttachments()
  } catch (error) {
    console.error('裁剪保存失败:', error)
    ElMessage.error('裁剪保存失败')
  } finally {
    editingAttachment.value = null
  }
}

function handleCropCancel(): void {
  editingAttachment.value = null
}
</script>

<template>
  <div class="attachment-library-page app-page-shell">
    <page-header :icon="['solid', 'images']" title="附件库" :subtitle="attachmentCountText">
      <template #left>
        <el-tooltip content="返回工具" placement="top">
          <el-button size="small" circle aria-label="返回工具" @click="backToTools">
            <font-awesome-icon :icon="['solid', 'arrow-left']" />
          </el-button>
        </el-tooltip>
      </template>
      <template #right>
        <el-button type="primary" size="small" :loading="uploading" @click="handleUploadClick">
          <template #icon><font-awesome-icon :icon="['solid', 'cloud-arrow-up']" /></template>
          上传图片
        </el-button>
      </template>
    </page-header>

    <input
      ref="fileInputRef"
      class="file-input"
      type="file"
      accept="image/*"
      multiple
      @change="handleFileChange"
    />

    <section
      class="attachment-panel"
      :class="attachmentPanelClass"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <div class="attachment-panel__toolbar">
        <span class="attachment-panel__hint">{{ attachmentHintText }}</span>
        <div class="attachment-panel__actions">
          <el-button size="small" @click="selectAll" :disabled="attachments.length === 0">
            全选
          </el-button>
          <el-button
            size="small"
            :disabled="selectedCount === 0"
            @click="clearSelection"
          >
            取消选择
          </el-button>
          <el-button
            type="danger"
            size="small"
            :disabled="selectedCount === 0"
            @click="handleBatchDelete"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
            删除选中
          </el-button>
        </div>
      </div>

      <div v-if="attachments.length === 0 && !loading" class="attachment-empty">
        <font-awesome-icon :icon="['solid', 'images']" />
        <span>拖入图片或点击上传，建立试卷素材库</span>
      </div>

      <draggable
        v-else
        v-model="attachments"
        class="attachment-grid"
        item-key="id"
        handle=".attachment-drag-handle"
        :animation="180"
        @end="handleSortEnd"
      >
        <template #item="{ element: attachment }">
          <article class="attachment-card" :class="{ selected: selectedIds.includes(attachment.id) }">
            <button
              class="attachment-drag-handle"
              type="button"
              aria-label="拖动排序"
              title="拖动排序"
            >
              <font-awesome-icon :icon="['solid', 'grip-vertical']" />
            </button>
            <el-checkbox
              class="attachment-select"
              :model-value="selectedIds.includes(attachment.id)"
              @change="toggleSelect(attachment.id)"
            />
            <button class="attachment-preview" type="button" @click="openPreview(attachment)">
              <span class="attachment-preview__backdrop"></span>
              <img :src="attachment.url" :alt="attachment.name" />
              <span class="attachment-preview__overlay">
                <span class="attachment-preview__overlay-icon">
                  <font-awesome-icon :icon="['solid', 'magnifying-glass-plus']" />
                </span>
                <span class="attachment-preview__overlay-text">查看大图</span>
              </span>
            </button>
            <div class="attachment-info">
              <div class="attachment-info__title-row">
                <strong>{{ attachment.name }}</strong>
                <el-dropdown trigger="click" placement="bottom-end">
                  <button class="attachment-more-button" type="button" aria-label="更多操作">
                    <font-awesome-icon :icon="['solid', 'ellipsis']" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="handleRename(attachment)">
                        重命名
                      </el-dropdown-item>
                      <el-dropdown-item @click="openCropper(attachment)">
                        裁剪
                      </el-dropdown-item>
                      <el-dropdown-item divided @click="handleDelete(attachment)">
                        删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div class="attachment-meta">
                <span class="attachment-meta__item">{{ attachment.width }} × {{ attachment.height }}</span>
                <span class="attachment-meta__item">
                  {{ getAttachmentOrientationLabel(attachment) }}
                </span>
              </div>
            </div>
          </article>
        </template>
      </draggable>
    </section>

    <el-dialog
      v-model="previewVisible"
      width="860px"
      title="图片预览"
      :close-on-click-modal="false"
    >
      <div v-if="previewAttachment" class="preview-dialog">
        <img :src="previewAttachment.url" :alt="previewAttachment.name" />
      </div>
    </el-dialog>

    <image-cropper
      v-model:visible="cropperVisible"
      :image-src="cropperImageSrc"
      :output-type="cropperOutputType"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
  </div>
</template>

<style scoped lang="scss">
.attachment-library-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.file-input {
  display: none;
}

.attachment-panel {
  min-height: 0;
  flex: 1;
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%),
    #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
  overflow: auto;
}

.attachment-panel.has-selection {
  border-color: color-mix(in srgb, var(--theme-menu-active) 16%, #dbe4f0);
}

.attachment-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.attachment-panel__hint {
  color: #6b7280;
  font-size: 12px;
}

.attachment-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-empty {
  min-height: 420px;
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

.attachment-empty svg {
  font-size: 30px;
}

.attachment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 12px;
}

.attachment-card {
  position: relative;
  min-width: 0;
  padding: 10px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, #ffffff 100%),
    #fff;
  border: 1px solid #e7edf5;
  border-radius: 16px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.attachment-card:hover {
  transform: translateY(-2px);
  border-color: #d7e3f0;
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.1);
}

.attachment-card.selected {
  border-color: color-mix(in srgb, var(--theme-menu-active) 42%, #bfd6fb);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-menu-active) 6%, #ffffff) 0%, #ffffff 100%),
    #fff;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--theme-menu-active) 16%, #eef4ff),
    0 18px 34px rgba(15, 23, 42, 0.08);
}

.attachment-drag-handle {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 3;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7b8794;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 999px;
  opacity: 0.45;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    color 0.2s ease;
  cursor: grab;
}

.attachment-card:hover .attachment-drag-handle,
.attachment-card.selected .attachment-drag-handle {
  opacity: 1;
}

.attachment-drag-handle:hover {
  color: #475569;
  transform: scale(1.03);
}

.attachment-select {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  padding: 4px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 999px;
  backdrop-filter: blur(10px);
}

.attachment-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 10 / 8;
  padding: 0;
  background:
    linear-gradient(135deg, #f7f9fc 0%, #eef3f9 100%);
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  isolation: isolate;
}

.attachment-preview img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition:
    transform 0.22s ease,
    filter 0.22s ease;
}

.attachment-preview__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.88), transparent 32%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(226, 232, 240, 0.16));
}

.attachment-preview__overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #fff;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0.44) 100%);
  opacity: 0;
  transition: opacity 0.22s ease;
}

.attachment-preview__overlay-icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  backdrop-filter: blur(8px);
}

.attachment-preview__overlay-text {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.attachment-card:hover .attachment-preview img {
  transform: scale(1.03);
  filter: saturate(1.04);
}

.attachment-card:hover .attachment-preview__overlay {
  opacity: 1;
}

.attachment-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.attachment-info__title-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.attachment-info strong {
  flex: 1;
  overflow: hidden;
  color: #1e293b;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.attachment-more-button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.attachment-more-button:hover {
  color: #334155;
  background: #f1f5f9;
}

.attachment-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.attachment-meta__item {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
}

.preview-dialog {
  max-height: 70vh;
  display: flex;
  justify-content: center;
  background: #f3f4f6;
  overflow: auto;
}

.preview-dialog img {
  max-width: 100%;
  object-fit: contain;
}
</style>
