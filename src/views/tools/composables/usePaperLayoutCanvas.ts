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
  /** 画布条目列表 */
  const canvasItems = ref<PaperLayoutCanvasItemType[]>([])
  /** 当前选中条目 ID */
  const selectedItemId = ref('')
  /** 预览缩放比例 */
  const previewScale = ref(1)
  /** 当前停留页码（从 1 开始） */
  const activePageNumber = ref(1)
  /** 拖拽/缩放进行中的状态 */
  const dragState = ref<PaperLayoutDragStateType | null>(null)

  /** 当前设置对应的页面尺寸（毫米） */
  const pageSize = computed(() => getPaperLayoutPageSize(options.settings))
  /** 归一化后的版式设置（列数、填充模式、边距与间距） */
  const layoutSettings = computed(() => ({
    columns: Math.max(options.settings.columns, 1),
    fitMode: options.settings.fitMode,
    gap: Math.max(options.settings.gap, 0),
    margin: Math.max(options.settings.margin, 0)
  }))
  /** 页面内容区宽度（扣除左右边距） */
  const contentWidth = computed(() =>
    Math.max(pageSize.value.width - layoutSettings.value.margin * 2, 1)
  )
  /** 页面内容区高度（扣除上下边距） */
  const contentHeight = computed(() =>
    Math.max(pageSize.value.height - layoutSettings.value.margin * 2, 1)
  )
  const columnWidth = computed(() => {
    const columns = layoutSettings.value.columns
    // 列宽 =（内容宽 - 各列间距之和）/ 列数，至少保留 1mm
    return Math.max((contentWidth.value - layoutSettings.value.gap * (columns - 1)) / columns, 1)
  })

  /** 自动排版所需的版式指标 */
  const layoutMetrics = computed(() => ({
    pageSize: pageSize.value,
    margin: layoutSettings.value.margin,
    gap: layoutSettings.value.gap,
    columns: layoutSettings.value.columns,
    fitMode: layoutSettings.value.fitMode,
    columnWidth: columnWidth.value,
    contentHeight: contentHeight.value
  }))

  /** 新增图片分页摆放所需的版式指标 */
  const pagePlacementMetrics = computed(() => ({
    pageSize: pageSize.value,
    margin: layoutSettings.value.margin,
    gap: layoutSettings.value.gap,
    columns: layoutSettings.value.columns,
    fitMode: layoutSettings.value.fitMode,
    columnWidth: columnWidth.value,
    contentHeight: contentHeight.value
  }))

  /** 按页面切分后的渲染数据 */
  const pages = computed(() => buildPaperLayoutPages(canvasItems.value, pageSize.value))
  /** 页面总数 */
  const pageCount = computed(() => pages.value.length)

  /** 当前选中的画布条目 */
  const selectedItem = computed(() => {
    return canvasItems.value.find((item) => item.id === selectedItemId.value)
  })

  // 优先定位到选中项所在页，否则使用手动页码
  const activePageIndex = computed(
    () => selectedItem.value?.pageIndex ?? activePageNumber.value - 1
  )

  /** 纸张页面的内联样式（实际尺寸与边距指示线） */
  const pageStyle = computed(() => ({
    width: `${mmToPixelPrecise(pageSize.value.width)}px`,
    height: `${mmToPixelPrecise(pageSize.value.height)}px`,
    '--paper-margin': `${mmToPixelPrecise(layoutSettings.value.margin)}px`
  }))

  /** 按预览缩放计算出的纸张占位尺寸，避免缩放引起布局跳动 */
  const scaledPageStyle = computed(() => ({
    width: `${mmToPixelPrecise(pageSize.value.width) * previewScale.value}px`,
    height: `${mmToPixelPrecise(pageSize.value.height) * previewScale.value}px`
  }))

  /** 预览缩放的百分比文案 */
  const previewPercent = computed(() => `${Math.round(previewScale.value * 100)}%`)

  const currentImagesHint = computed(() => {
    if (canvasItems.value.length === 0) return '添加图片后开始排版'
    return `${canvasItems.value.length} 张图片 / ${pageCount.value} 页`
  })

  /** 将素材记录转换为画布条目 */
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

  /** 释放画布条目占用的 object URL */
  function revokeItemUrls(items = canvasItems.value): void {
    items.forEach((item) => {
      URL.revokeObjectURL(item.dataUrl)
    })
  }

  /** 将素材追加到画布当前停留页 */
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

  /** 按当前版式对全部图片重新自动排版 */
  function autoArrange(): void {
    canvasItems.value = arrangePaperItems(canvasItems.value, layoutMetrics.value)
  }

  /** 纸张尺寸变化后，重新同步所有条目的页码与坐标 */
  function syncCanvasItemPositions(): void {
    canvasItems.value.forEach((item) => {
      const normalizedPosition = normalizePaperItemPosition(item, item.documentY, pageSize.value)
      item.pageIndex = normalizedPosition.pageIndex
      item.y = normalizedPosition.y
      item.documentY = normalizedPosition.documentY
    })
  }

  /** 选中指定条目 */
  function selectItem(id: string): void {
    selectedItemId.value = id
  }

  /** 将条目提升到最顶层 */
  function bringItemToFront(item: PaperLayoutCanvasItemType): void {
    const nextZIndex = getNextPaperLayoutZIndex(canvasItems.value)
    // 仅当不在最顶层时才提升层级，避免无意义的层级变化
    if (item.zIndex < nextZIndex - 1) {
      item.zIndex = nextZIndex
    }
  }

  /** 清空选中 */
  function clearSelection(): void {
    selectedItemId.value = ''
  }

  /** 点击空白处清空选中；点击图片或工具按钮时不处理 */
  function handleToolClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null
    if (target?.closest('.paper-image-frame')) return
    if (target?.closest('.selected-item-action')) return
    clearSelection()
  }

  /** 开始拖拽移动条目，记录起始状态 */
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

  /** 开始拖拽缩放条目，记录起始状态 */
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

  /** 将坐标限制在允许拖动的范围内 */
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

  /** 应用归一化位置，同步更新 pageIndex/y/documentY */
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

  /** 指针移动时更新拖拽或缩放中的条目位置与尺寸 */
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

  /** 指针抬起时结束拖拽/缩放 */
  function handlePointerUp(): void {
    dragState.value = null
  }

  /** 按倍率缩放选中条目并保持宽高比 */
  function scaleSelectedItem(factor: number): void {
    const item = selectedItem.value
    if (!item) return

    const nextWidth = Math.max(minItemWidthMm, item.width * factor)
    const ratio = item.height / item.width
    item.width = nextWidth
    item.height = nextWidth * ratio
    applyNormalizedPosition(item, clampItemPosition(item, item.x, item.documentY))
  }

  /** 删除选中条目并释放其图片 URL */
  function removeSelectedItem(): void {
    const item = selectedItem.value
    if (!item) return
    URL.revokeObjectURL(item.dataUrl)
    canvasItems.value = canvasItems.value.filter((currentItem) => currentItem.id !== item.id)
    clearSelection()
  }

  /** 覆盖画布条目列表（打开草稿时使用） */
  function setCanvasItems(items: PaperLayoutCanvasItemType[]): void {
    canvasItems.value = items
  }

  /** 清空画布条目与选中 */
  function clearCanvasItems(): void {
    canvasItems.value = []
    clearSelection()
  }

  /** 设置预览缩放比例并限制在允许范围内 */
  function setPreviewScale(scale: number): void {
    previewScale.value = Math.min(Math.max(scale, 0.35), 1.4)
  }

  /** 按档位放大（1）或缩小（-1）预览 */
  function zoomPreview(direction: -1 | 1): void {
    setPreviewScale(previewScale.value + direction * 0.1)
  }

  /** 根据面板宽度自动适配预览缩放 */
  function fitPreviewWidth(): void {
    const panelWidth = options.previewPanelRef.value?.clientWidth || 0
    const pageWidth = mmToPixelPrecise(pageSize.value.width)
    if (!panelWidth || !pageWidth) return

    const availableWidth = Math.max(panelWidth - 32, 120)
    setPreviewScale(availableWidth / pageWidth)
  }

  /** 计算缩放手柄的位置样式，使其贴在可见区域右下角 */
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

  /** 滚动预览时更新当前停留页 */
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
