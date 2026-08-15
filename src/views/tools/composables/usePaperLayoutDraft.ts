import { ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { normalizePaperLayoutSettings } from '@/views/tools/constants/paperLayout'
import {
  getPaperLayoutDrafts,
  savePaperLayoutDraft
} from '@/views/tools/services/paperLayoutDraftService'
import type { PaperLayoutPageSizeType } from '@/views/tools/utils/paperLayoutCanvas'
import type {
  AttachmentRecordType,
  PaperLayoutCanvasItemType,
  PaperLayoutDraftRecordType,
  PaperLayoutSettingsType
} from '@/types/Tools'

/** 试卷排版草稿管理组合式函数的入参 */
interface UsePaperLayoutDraftOptions {
  settings: PaperLayoutSettingsType
  canvasItems: Ref<PaperLayoutCanvasItemType[]>
  pageSize: ComputedRef<PaperLayoutPageSizeType>
  toCanvasItem: (attachment: AttachmentRecordType, index: number) => PaperLayoutCanvasItemType
  revokeItemUrls: () => void
  setCanvasItems: (items: PaperLayoutCanvasItemType[]) => void
  clearSelection: () => void
}

/**
 * 管理试卷排版草稿的保存与打开。
 *
 * 保存时把画布条目转换为可持久化的草稿条目，打开时重建画布条目
 * 并恢复设置；同时维护草稿数量与当前草稿标识。
 *
 * @param options 排版设置、画布条目及相关操作方法
 * @returns 草稿状态与保存/打开方法
 */
export function usePaperLayoutDraft(options: UsePaperLayoutDraftOptions) {
  const draftCount = ref(0)
  const currentDraftId = ref('')
  const currentDraftName = ref('')

  async function refreshDraftCount(): Promise<void> {
    draftCount.value = (await getPaperLayoutDrafts()).length
  }

  function resetCurrentDraft(): void {
    currentDraftId.value = ''
    currentDraftName.value = ''
  }

  async function handleSaveDraft(): Promise<void> {
    if (options.canvasItems.value.length === 0) {
      ElMessage.warning('请先加入图片')
      return
    }

    try {
      const result = await ElMessageBox.prompt('请输入草稿名称', '保存草稿', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: currentDraftName.value || `试卷排版_${new Date().toLocaleDateString()}`,
        inputValidator: (value) => value.trim().length > 0,
        inputErrorMessage: '名称不能为空'
      })

      // 草稿只持久化排版所需字段，dataUrl 在打开草稿时通过 blob 重新生成
      const savedDraft = await savePaperLayoutDraft({
        id: currentDraftId.value || undefined,
        name: result.value.trim(),
        settings: normalizePaperLayoutSettings(options.settings),
        items: options.canvasItems.value.map((item, index) => ({
          id: item.id,
          attachmentId: item.attachmentId,
          name: item.name,
          mimeType: item.mimeType,
          blob: item.blob,
          naturalWidth: item.naturalWidth,
          naturalHeight: item.naturalHeight,
          order: index,
          pageIndex: item.pageIndex,
          x: item.x,
          y: item.y,
          documentY: item.documentY,
          width: item.width,
          height: item.height,
          zIndex: item.zIndex
        }))
      })
      currentDraftId.value = savedDraft.id
      currentDraftName.value = savedDraft.name
      await refreshDraftCount()
      ElMessage.success('草稿已保存')
    } catch {
      // 取消保存属于正常交互，不需要额外提示。
    }
  }

  async function handleOpenDraft(draft: PaperLayoutDraftRecordType): Promise<void> {
    Object.assign(options.settings, normalizePaperLayoutSettings(draft.settings))

    // 按保存时的 order 排序，保证图层与顺序一致
    const sortedDraftItems = [...draft.items].sort(
      (first, second) => (first.order || 0) - (second.order || 0)
    )
    const nextItems: PaperLayoutCanvasItemType[] = sortedDraftItems.map((draftItem, index) => {
      const attachment: AttachmentRecordType = {
        id: draftItem.attachmentId,
        name: draftItem.name,
        mimeType: draftItem.mimeType,
        blob: draftItem.blob,
        sortOrder: index,
        width: draftItem.naturalWidth,
        height: draftItem.naturalHeight,
        size: draftItem.blob.size,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt
      }
      const item = options.toCanvasItem(attachment, index)
      return {
        ...item,
        id: draftItem.id || item.id,
        pageIndex: draftItem.pageIndex ?? 0,
        x: draftItem.x ?? item.x,
        y: draftItem.y ?? item.y,
        // 旧草稿可能只有 pageIndex/y，这里兼容计算出 documentY
        documentY:
          draftItem.documentY ??
          (draftItem.pageIndex ?? 0) * options.pageSize.value.height + (draftItem.y ?? item.y),
        width: draftItem.width ?? item.width,
        height: draftItem.height ?? item.height,
        zIndex: draftItem.zIndex ?? index + 1
      }
    })

    options.revokeItemUrls()
    options.setCanvasItems(nextItems)
    options.clearSelection()
    currentDraftId.value = draft.id
    currentDraftName.value = draft.name
    ElMessage.success('草稿已打开')
    await refreshDraftCount()
  }

  return {
    currentDraftId,
    currentDraftName,
    draftCount,
    handleOpenDraft,
    handleSaveDraft,
    refreshDraftCount,
    resetCurrentDraft
  }
}
