import { computed, onBeforeUnmount, ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import {
  addFilesToAttachments,
  attachmentToObjectUrl,
  deleteAttachment,
  getAttachments,
  renameAttachment,
  updateAttachmentOrder,
  updateAttachmentFromCroppedBase64
} from '@/views/tools/services/attachmentService'

import type { AttachmentViewType } from '@/types/Tools'
import type { AttachmentRecordType } from '@/types/Tools'

/** 管理素材加载、选择、排序和裁剪流程，统一释放预览对象 URL。 */
export function useAttachmentLibrary() {
  /** 隐藏的文件选择输入框，由上传按钮间接触发 */
  const fileInputRef = ref<HTMLInputElement | null>(null)

  /** 素材视图记录列表 */
  const attachments = ref<AttachmentViewType[]>([])

  /** 列表加载中状态 */
  const loading = ref(false)

  /** 上传进行中状态 */
  const uploading = ref(false)

  /** 裁剪弹窗的显示与数据状态 */
  const cropperVisible = ref(false)

  const cropperImageSrc = ref('')

  const editingAttachment = ref<AttachmentViewType | null>(null)

  /** 大图预览的显示与数据状态 */
  const previewAttachment = ref<AttachmentViewType | null>(null)

  const previewVisible = ref(false)

  /** 已选素材 ID 列表 */
  const selectedIds = ref<string[]>([])

  /** 素材数量提示文案 */
  const attachmentCountText = computed(() => {
    return attachments.value.length === 0 ? '暂无图片素材' : `共 ${attachments.value.length} 张图片`
  })

  /** 已选素材数量 */
  const selectedCount = computed(() => selectedIds.value.length)

  /** 带选中数量的提示文案 */
  const attachmentHintText = computed(() => {
    return selectedCount.value > 0
      ? `${attachmentCountText.value} · 已选 ${selectedCount.value} 张`
      : attachmentCountText.value
  })

  /** 有选中素材时给面板附加高亮类名 */
  const attachmentPanelClass = computed(() => ({
    'has-selection': selectedCount.value > 0
  }))

  /** 裁剪输出类型：PNG 素材保留透明，其余转 JPEG */
  const cropperOutputType = computed<'jpeg' | 'png'>(() => {
    return editingAttachment.value?.mimeType === 'image/png' ? 'png' : 'jpeg'
  })

  // 进入页面即加载素材列表
  loadAttachments()

  onBeforeUnmount(() => {
    revokeAttachmentUrls()
  })

  /** 释放所有素材视图记录的 object URL */
  function revokeAttachmentUrls(): void {
    attachments.value.forEach((attachment) => {
      URL.revokeObjectURL(attachment.url)
    })
  }

  /** 为素材记录补充临时预览 URL，转换为视图记录 */
  function toViewRecord(record: AttachmentRecordType): AttachmentViewType {
    return {
      ...record,
      url: attachmentToObjectUrl(record)
    }
  }

  /** 加载素材列表并重建视图记录 */
  async function loadAttachments(): Promise<void> {
    loading.value = true
    try {
      const records = await getAttachments()
      // 重建视图记录前先释放旧 object URL，避免内存泄漏
      revokeAttachmentUrls()
      attachments.value = records.map(toViewRecord)
    } finally {
      loading.value = false
    }
  }

  /** 切换单张素材的选中状态 */
  function toggleSelect(id: string): void {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((item) => item !== id)
      return
    }
    selectedIds.value = [...selectedIds.value, id]
  }

  /** 全选所有素材 */
  function selectAll(): void {
    selectedIds.value = attachments.value.map((attachment) => attachment.id)
  }

  /** 清空选中 */
  function clearSelection(): void {
    selectedIds.value = []
  }

  /** 拖拽排序结束后持久化新顺序 */
  async function handleSortEnd(): Promise<void> {
    try {
      // 拖拽结束时 v-model 已更新为新顺序，按当前列表顺序重写 sortOrder 落库
      await updateAttachmentOrder(attachments.value.map((attachment) => attachment.id))
    } catch (error) {
      console.error('保存附件顺序失败:', error)
      ElMessage.error('保存排序失败')
      await loadAttachments()
    }
  }

  /** 点击上传按钮时触发隐藏的文件输入框 */
  function handleUploadClick(): void {
    fileInputRef.value?.click()
  }

  /** 处理文件选择变更，读取文件后统一走上传流程 */
  async function handleFileChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement
    const files = Array.from(target.files || [])
    target.value = ''
    await uploadFiles(files)
  }

  /** 处理拖拽放入面板的图片文件 */
  async function handleDrop(event: DragEvent): Promise<void> {
    const files = Array.from(event.dataTransfer?.files || [])
    await uploadFiles(files)
  }

  /** 上传文件到素材库并刷新列表 */
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

  /** 重命名素材：弹窗输入新名称后保存并刷新 */
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

  /** 删除单个素材：确认后删除并刷新列表 */
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

  /** 批量删除选中素材 */
  async function handleBatchDelete(): Promise<void> {
    if (selectedIds.value.length === 0) return

    try {
      await ElMessageBox.confirm(
        `确认删除选中的 ${selectedIds.value.length} 个附件？`,
        '批量删除',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      // 逐条删除选中素材，成功后统一刷新列表
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

  /** 打开裁剪弹窗并记录当前编辑的素材 */
  function openCropper(attachment: AttachmentViewType): void {
    editingAttachment.value = attachment
    cropperImageSrc.value = attachment.url
    cropperVisible.value = true
  }

  /** 打开大图预览弹窗 */
  function openPreview(attachment: AttachmentViewType): void {
    previewAttachment.value = attachment
    previewVisible.value = true
  }

  /** 根据宽高返回横向/纵向标签 */
  function getAttachmentOrientationLabel(attachment: AttachmentViewType): string {
    return attachment.width >= attachment.height ? '横向' : '纵向'
  }

  /** 保存裁剪结果并刷新列表 */
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

  /** 取消裁剪，清空编辑中的素材 */
  function handleCropCancel(): void {
    editingAttachment.value = null
  }
  return {
    fileInputRef,
    attachments,
    loading,
    uploading,
    cropperVisible,
    cropperImageSrc,
    cropperOutputType,
    previewAttachment,
    previewVisible,
    selectedIds,
    attachmentCountText,
    selectedCount,
    attachmentHintText,
    attachmentPanelClass,
    toggleSelect,
    selectAll,
    clearSelection,
    handleSortEnd,
    handleUploadClick,
    handleFileChange,
    handleDrop,
    handleRename,
    handleDelete,
    handleBatchDelete,
    openCropper,
    openPreview,
    getAttachmentOrientationLabel,
    handleCropConfirm,
    handleCropCancel
  }
}
