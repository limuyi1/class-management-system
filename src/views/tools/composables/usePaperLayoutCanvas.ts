import { computed, nextTick, ref, type Ref } from 'vue'

import { attachmentToObjectUrl } from '@/views/tools/services/attachmentService'
import { mmToPixelPrecise } from '@/utils/pageSizeInPixelUtil'
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

/** 图片至少保留的可见区域（毫米），避免被完全拖出画布 */
const minVisibleMm = 8
/** 缩放时图片的最小宽度（毫米） */
const minItemWidthMm = 18
/** 屏幕每毫米对应的像素数（96 DPI） */
const screenPixelsPerMillimeter = 96 / 25.4

/**
 * 将指针位移换算为毫米单位的画布位移。
 *
 * @param event 指针事件
 * @param state 拖拽起始状态
 * @param previewScale 当前预览缩放比例
 * @returns 换算后的毫米位移
 */
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

/** 试卷排版画布组合式函数的入参 */
interface UsePaperLayoutCanvasOptions {
  settings: PaperLayoutSettingsType
  previewPanelRef: Ref<HTMLElement | null>
}

/**
 * 管理试卷排版画布的条目、选中、拖拽缩放与分页。
 *
 * 负责把素材转换为画布条目、按版式自动排布、处理拖拽/缩放/删除，
 * 并提供预览缩放、翻页与滚动定位等能力。
 *
 * @param options 排版设置与预览面板引用
 * @returns 画布状态与各类操作方法
 */
export function usePaperLayoutCanvas(options: UsePaperLayoutCanvasOptions) {
  const canvasItems = ref<PaperLayoutCanvasItemType[]>([])
  const selectedItemId = ref('')
  const previewScale = ref(1)
  const activePageNumber = ref(1)
  const dragState = ref<PaperLayoutDragStateType | null>(null)

  const pageSize = computed(() => getPaperLayoutPageSize(options.settings))
  const layoutSettings = computed(() => ({
    columns: Math.max(options.settings.columns, 1),
    fitMode: options.settings.fitMode,
    gap: Math.max(options.settings.gap, 0),
    margin: Math.max(options.settings.margin, 0)
  }))
  const contentWidth = computed(() =>
    Math.max(pageSize.value.width - layoutSettings.value.margin * 2, 1)
  )
  const contentHeight = computed(() =>
    Math.max(pageSize.value.height - layoutSettings.value.margin * 2, 1)
  )
  const columnWidth = computed(() => {
    const columns = layoutSettings.value.columns
    // 列宽 =（内容宽 - 各列间距之和）/ 列数，至少保留 1mm
    return Math.max((contentWidth.value - layoutSettings.value.gap * (columns - 1)) / columns, 1)
  })

  const layoutMetrics = computed(() => ({
    pageSize: pageSize.value,
    margin: layoutSettings.value.margin,
    gap: layoutSettings.value.gap,
    columns: layoutSettings.value.columns,
    fitMode: layoutSettings.value.fitMode,
    columnWidth: columnWidth.value,
    contentHeight: contentHeight.value
  }))

  const pagePlacementMetrics = computed(() => ({
    pageSize: pageSize.value,
    margin: layoutSettings.value.margin,
    gap: layoutSettings.value.gap,
    columns: layoutSettings.value.columns,
    fitMode: layoutSettings.value.fitMode,
    columnWidth: columnWidth.value,
    contentHeight: contentHeight.value
  }))

  const pages = computed(() => buildPaperLayoutPages(canvasItems.value, pageSize.value))
  const pageCount = computed(() => pages.value.length)

  const selectedItem = computed(() => {
    return canvasItems.value.find((item) => item.id === selectedItemId.value)
  })

  // 优先定位到选中项所在页，否则使用手动页码
  const activePageIndex = computed(
    () => selectedItem.value?.pageIndex ?? activePageNumber.value - 1
  )

  const pageStyle = computed(() => ({
    width: `${mmToPixelPrecise(pageSize.value.width)}px`,
    height: `${mmToPixelPrecise(pageSize.value.height)}px`,
    '--paper-margin': `${mmToPixelPrecise(layoutSettings.value.margin)}px`
  }))

  const scaledPageStyle = computed(() => ({
    width: `${mmToPixelPrecise(pageSize.value.width) * previewScale.value}px`,
    height: `${mmToPixelPrecise(pageSize.value.height) * previewScale.value}px`
  }))

  const previewPercent = computed(() => `${Math.round(previewScale.value * 100)}%`)

  const currentImagesHint = computed(() => {
    if (canvasItems.value.length === 0) return '添加图片后开始排版'
    return `${canvasItems.value.length} 张图片 / ${pageCount.value} 页`
  })

  function toCanvasItem(
    attachment: AttachmentRecordType,
    index: number
  ): PaperLayoutCanvasItemType {
    return createPaperLayoutItem(attachment, {
      index,
      dataUrl: attachmentToObjectUrl(attachment),
      margin: layoutSettings.value.margin,
      columnWidth: columnWidth.value
    })
  }

  function revokeItemUrls(items = canvasItems.value): void {
    items.forEach((item) => {
      URL.revokeObjectURL(item.dataUrl)
    })
  }

  function handleSelectAttachments(attachments: AttachmentRecordType[]): void {
    // 新图片摆放到当前停留页，层级从现有最大层级之后续接
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
    // 仅当不在最顶层时才提升层级，避免无意义的层级变化
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

    // 缩放时保持原始宽高比，并限制最小宽度
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
    // 缩放手柄始终贴在图片可见区域的右下角
    const visibleRight = Math.min(item.width, pageSize.value.width - item.x)
    const visibleBottom = Math.min(item.height, pageSize.value.height - item.y)

    return {
      left: `${mmToPixelPrecise(Math.max(0, visibleRight)) - 5}px`,
      top: `${mmToPixelPrecise(Math.max(0, visibleBottom)) - 5}px`
    }
  }

  /** 更新当前页并平滑滚动到指定页面 */
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

    // 取离顶部参考线最近的页面作为当前页
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
