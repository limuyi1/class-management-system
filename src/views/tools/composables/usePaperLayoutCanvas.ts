import { computed, nextTick, ref, type Ref } from 'vue'

import { getPaperLayoutPreset } from '@/views/tools/constants/paperLayout'
import { attachmentToObjectUrl } from '@/views/tools/services/attachmentService'
import { mmToPixelPrecise } from '@/utils/pageSizeInPixelUntil'
import {
  arrangePaperItems,
  buildPaperLayoutPages,
  clampPaperItemPosition,
  createPaperLayoutItem,
  getNextPaperLayoutZIndex,
  getPaperLayoutPageSize,
  normalizePaperItemPosition,
  placePaperItemsOnPage
} from '@/views/tools/utils/paperLayoutCanvas'
import type {
  AttachmentRecordType,
  PaperLayoutCanvasItemType,
  PaperLayoutDragStateType,
  PaperLayoutSettingsType
} from '@/types/Tools'

const minVisibleMm = 8
const minItemWidthMm = 18
const screenPixelsPerMillimeter = 96 / 25.4

export function getPaperLayoutPointerDelta(
  event: Pick<PointerEvent, 'clientX' | 'clientY'>,
  state: Pick<PaperLayoutDragStateType, 'startClientX' | 'startClientY'>,
  previewScale: number
): { deltaX: number; deltaY: number } {
  return {
    deltaX: (event.clientX - state.startClientX) / previewScale / screenPixelsPerMillimeter,
    deltaY: (event.clientY - state.startClientY) / previewScale / screenPixelsPerMillimeter
  }
}

interface UsePaperLayoutCanvasOptions {
  settings: PaperLayoutSettingsType
  previewPanelRef: Ref<HTMLElement | null>
}

export function usePaperLayoutCanvas(options: UsePaperLayoutCanvasOptions) {
  const canvasItems = ref<PaperLayoutCanvasItemType[]>([])
  const selectedItemId = ref('')
  const previewScale = ref(1)
  const activePageNumber = ref(1)
  const dragState = ref<PaperLayoutDragStateType | null>(null)

  const pageSize = computed(() => getPaperLayoutPageSize(options.settings))
  const layoutPreset = computed(() => getPaperLayoutPreset(options.settings.orientation))
  const contentWidth = computed(() => pageSize.value.width - layoutPreset.value.margin * 2)
  const contentHeight = computed(() => pageSize.value.height - layoutPreset.value.margin * 2)
  const columnWidth = computed(() => {
    return (
      (contentWidth.value - layoutPreset.value.gap * (layoutPreset.value.columns - 1)) /
      layoutPreset.value.columns
    )
  })

  const layoutMetrics = computed(() => ({
    pageSize: pageSize.value,
    margin: layoutPreset.value.margin,
    gap: layoutPreset.value.gap,
    columns: layoutPreset.value.columns,
    columnWidth: columnWidth.value,
    contentHeight: contentHeight.value
  }))

  const pagePlacementMetrics = computed(() => ({
    pageSize: pageSize.value,
    margin: layoutPreset.value.margin,
    gap: layoutPreset.value.gap,
    columns: layoutPreset.value.columns,
    columnWidth: columnWidth.value
  }))

  const pages = computed(() => buildPaperLayoutPages(canvasItems.value, pageSize.value))
  const pageCount = computed(() => pages.value.length)

  const selectedItem = computed(() => {
    return canvasItems.value.find((item) => item.id === selectedItemId.value)
  })

  const activePageIndex = computed(() => selectedItem.value?.pageIndex ?? activePageNumber.value - 1)

  const pageStyle = computed(() => ({
    width: `${mmToPixelPrecise(pageSize.value.width)}px`,
    height: `${mmToPixelPrecise(pageSize.value.height)}px`,
    '--paper-margin': `${mmToPixelPrecise(layoutPreset.value.margin)}px`
  }))

  const scaledPageStyle = computed(() => ({
    width: `${mmToPixelPrecise(pageSize.value.width) * previewScale.value}px`,
    height: `${mmToPixelPrecise(pageSize.value.height) * previewScale.value}px`
  }))

  const previewPercent = computed(() => `${Math.round(previewScale.value * 100)}%`)

  const currentImagesHint = computed(() => {
    if (canvasItems.value.length === 0) return '从附件库选择图片后开始排版'
    return `${canvasItems.value.length} 张图片 / ${pageCount.value} 页`
  })

  function toCanvasItem(
    attachment: AttachmentRecordType,
    index: number
  ): PaperLayoutCanvasItemType {
    return createPaperLayoutItem(attachment, {
      index,
      dataUrl: attachmentToObjectUrl(attachment),
      margin: layoutPreset.value.margin,
      columnWidth: columnWidth.value
    })
  }

  function revokeItemUrls(items = canvasItems.value): void {
    items.forEach((item) => {
      URL.revokeObjectURL(item.dataUrl)
    })
  }

  function handleSelectAttachments(attachments: AttachmentRecordType[]): void {
    const targetPageIndex = Math.max(activePageNumber.value - 1, 0)
    const nextZIndex = getNextPaperLayoutZIndex(canvasItems.value)
    const pendingItems = attachments.map((attachment, index) =>
      toCanvasItem(attachment, nextZIndex + index)
    )
    const nextItems = placePaperItemsOnPage(
      pendingItems,
      targetPageIndex,
      pagePlacementMetrics.value,
      nextZIndex
    )
    canvasItems.value = [...canvasItems.value, ...nextItems]
    selectedItemId.value = nextItems[nextItems.length - 1]?.id || selectedItemId.value
  }

  function autoArrange(): void {
    canvasItems.value = arrangePaperItems(canvasItems.value, layoutMetrics.value)
  }

  function syncCanvasItemPositions(): void {
    canvasItems.value.forEach((item) => {
      const normalizedPosition = normalizePaperItemPosition(item, item.documentY, pageSize.value)
      item.pageIndex = normalizedPosition.pageIndex
      item.y = normalizedPosition.y
      item.documentY = normalizedPosition.documentY
    })
  }

  function selectItem(id: string): void {
    selectedItemId.value = id
  }

  function bringItemToFront(item: PaperLayoutCanvasItemType): void {
    const nextZIndex = getNextPaperLayoutZIndex(canvasItems.value)
    if (item.zIndex < nextZIndex - 1) {
      item.zIndex = nextZIndex
    }
  }

  function clearSelection(): void {
    selectedItemId.value = ''
  }

  function handleToolClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null
    if (target?.closest('.paper-image-frame')) return
    if (target?.closest('.selected-item-action')) return
    clearSelection()
  }

  function startMove(event: PointerEvent, item: PaperLayoutCanvasItemType): void {
    selectItem(item.id)
    bringItemToFront(item)
    dragState.value = {
      itemId: item.id,
      mode: 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: item.x,
      startY: item.y,
      startDocumentY: item.documentY,
      startWidth: item.width,
      startHeight: item.height
    }
  }

  function startResize(event: PointerEvent, item: PaperLayoutCanvasItemType): void {
    event.stopPropagation()
    selectItem(item.id)
    bringItemToFront(item)
    dragState.value = {
      itemId: item.id,
      mode: 'resize',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: item.x,
      startY: item.y,
      startDocumentY: item.documentY,
      startWidth: item.width,
      startHeight: item.height
    }
  }

  function clampItemPosition(
    item: PaperLayoutCanvasItemType,
    x: number,
    documentY: number
  ): { x: number; documentY: number } {
    return clampPaperItemPosition(
      item,
      {
        x,
        documentY
      },
      {
        pageSize: pageSize.value,
        minVisibleMm
      }
    )
  }

  function applyNormalizedPosition(
    item: PaperLayoutCanvasItemType,
    position: { x: number; documentY: number }
  ): void {
    const normalizedPosition = normalizePaperItemPosition(item, position.documentY, pageSize.value)
    item.x = position.x
    item.y = normalizedPosition.y
    item.pageIndex = normalizedPosition.pageIndex
    item.documentY = normalizedPosition.documentY
  }

  function handlePointerMove(event: PointerEvent): void {
    const state = dragState.value
    if (!state) return

    const item = canvasItems.value.find((currentItem) => currentItem.id === state.itemId)
    if (!item) return

    const { deltaX, deltaY } = getPaperLayoutPointerDelta(event, state, previewScale.value)

    if (state.mode === 'move') {
      applyNormalizedPosition(
        item,
        clampItemPosition(item, state.startX + deltaX, state.startDocumentY + deltaY)
      )
      return
    }

    const ratio = state.startHeight / state.startWidth
    const width = Math.max(minItemWidthMm, state.startWidth + deltaX)
    item.width = width
    item.height = width * ratio
    applyNormalizedPosition(item, clampItemPosition(item, item.x, item.documentY))
  }

  function handlePointerUp(): void {
    dragState.value = null
  }

  function scaleSelectedItem(factor: number): void {
    const item = selectedItem.value
    if (!item) return

    const nextWidth = Math.max(minItemWidthMm, item.width * factor)
    const ratio = item.height / item.width
    item.width = nextWidth
    item.height = nextWidth * ratio
    applyNormalizedPosition(item, clampItemPosition(item, item.x, item.documentY))
  }

  function removeSelectedItem(): void {
    const item = selectedItem.value
    if (!item) return
    URL.revokeObjectURL(item.dataUrl)
    canvasItems.value = canvasItems.value.filter((currentItem) => currentItem.id !== item.id)
    clearSelection()
  }

  function setCanvasItems(items: PaperLayoutCanvasItemType[]): void {
    canvasItems.value = items
  }

  function clearCanvasItems(): void {
    canvasItems.value = []
    clearSelection()
  }

  function setPreviewScale(scale: number): void {
    previewScale.value = Math.min(Math.max(scale, 0.35), 1.4)
  }

  function zoomPreview(direction: -1 | 1): void {
    setPreviewScale(previewScale.value + direction * 0.1)
  }

  function fitPreviewWidth(): void {
    const panelWidth = options.previewPanelRef.value?.clientWidth || 0
    const pageWidth = mmToPixelPrecise(pageSize.value.width)
    if (!panelWidth || !pageWidth) return

    const availableWidth = Math.max(panelWidth - 32, 120)
    setPreviewScale(availableWidth / pageWidth)
  }

  function getResizeHandleStyle(item: PaperLayoutCanvasItemType): Record<string, string> {
    const visibleRight = Math.min(item.width, pageSize.value.width - item.x)
    const visibleBottom = Math.min(item.height, pageSize.value.height - item.y)

    return {
      left: `${mmToPixelPrecise(Math.max(0, visibleRight)) - 5}px`,
      top: `${mmToPixelPrecise(Math.max(0, visibleBottom)) - 5}px`
    }
  }

  function scrollToPage(index: number): void {
    activePageNumber.value = index + 1
    void nextTick(() => {
      document.querySelector(`[data-paper-page="${index}"]`)?.scrollIntoView({
        block: 'start',
        behavior: 'smooth'
      })
    })
  }

  function handlePreviewScroll(): void {
    const pageElements = Array.from(document.querySelectorAll<HTMLElement>('[data-paper-page]'))
    if (pageElements.length === 0) return

    const nearestPage = pageElements.reduce(
      (nearest, element) => {
        const distance = Math.abs(element.getBoundingClientRect().top - 160)
        return distance < nearest.distance ? { element, distance } : nearest
      },
      { element: pageElements[0], distance: Number.POSITIVE_INFINITY }
    )
    const pageIndex = Number(nearestPage.element.dataset.paperPage || 0)
    activePageNumber.value = pageIndex + 1
  }

  return {
    activePageIndex,
    activePageNumber,
    autoArrange,
    canvasItems,
    clearCanvasItems,
    clearSelection,
    currentImagesHint,
    fitPreviewWidth,
    getResizeHandleStyle,
    handlePointerMove,
    handlePointerUp,
    handlePreviewScroll,
    handleSelectAttachments,
    handleToolClick,
    pageCount,
    pages,
    pageSize,
    pageStyle,
    previewPercent,
    previewScale,
    removeSelectedItem,
    revokeItemUrls,
    scaledPageStyle,
    scaleSelectedItem,
    selectedItem,
    selectedItemId,
    setCanvasItems,
    startMove,
    startResize,
    syncCanvasItemPositions,
    toCanvasItem,
    zoomPreview,
    scrollToPage
  }
}
