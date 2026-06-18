import { getPdfPageSize } from '@/utils/evaluationPdfLayoutUntil'

import type {
  AttachmentRecordType,
  PaperLayoutCanvasItemType,
  PaperLayoutPageType,
  PaperLayoutRenderItemType,
  PaperLayoutSettingsType
} from '@/types/Tools'

export interface PaperLayoutPageSizeType {
  width: number
  height: number
}

export interface PaperLayoutMetricsType {
  pageSize: PaperLayoutPageSizeType
  margin: number
  gap: number
  columns: number
  columnWidth: number
  contentHeight: number
}

export interface PaperLayoutPositionType {
  pageIndex: number
  y: number
  documentY: number
}

export interface PaperLayoutPagePlacementMetricsType {
  pageSize: PaperLayoutPageSizeType
  margin: number
  gap: number
  columns: number
  columnWidth: number
}

export const createPaperLayoutId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const getPaperLayoutPageSize = (
  settings: PaperLayoutSettingsType
): PaperLayoutPageSizeType => {
  const size = getPdfPageSize(settings.pageType)
  if (settings.orientation === 'landscape') {
    return {
      width: size.height,
      height: size.width
    }
  }
  return size
}

export const createPaperLayoutItem = (
  attachment: AttachmentRecordType,
  options: {
    index: number
    dataUrl: string
    margin: number
    columnWidth: number
  }
): PaperLayoutCanvasItemType => ({
  // 初始尺寸按当前列宽等比计算，后续自动排版会统一修正页码、坐标和层级。
  id: createPaperLayoutId('paper-item'),
  attachmentId: attachment.id,
  name: attachment.name,
  blob: attachment.blob,
  dataUrl: options.dataUrl,
  mimeType: attachment.mimeType,
  naturalWidth: attachment.width,
  naturalHeight: attachment.height,
  pageIndex: 0,
  x: options.margin,
  y: options.margin,
  documentY: options.margin,
  width: options.columnWidth,
  height: options.columnWidth * (attachment.height / attachment.width),
  zIndex: options.index + 1
})

export const getNextPaperLayoutZIndex = (items: PaperLayoutCanvasItemType[]): number => {
  return Math.max(0, ...items.map((item) => item.zIndex)) + 1
}

export const getPaperItemDocumentY = (
  item: Pick<PaperLayoutCanvasItemType, 'documentY' | 'pageIndex' | 'y'>,
  pageSize: PaperLayoutPageSizeType
): number => {
  return item.documentY ?? item.pageIndex * pageSize.height + item.y
}

/**
 * 图片的真实位置用整份文档里的 documentY 表示，pageIndex/y 只作为兼容字段。
 * 每次拖动、缩放和打开旧草稿后都同步一次，避免 UI 与导出读到不同坐标。
 */
export const normalizePaperItemPosition = (
  item: PaperLayoutCanvasItemType,
  documentY: number,
  pageSize: PaperLayoutPageSizeType
): PaperLayoutPositionType => {
  const pageIndex = Math.max(Math.floor(documentY / pageSize.height), 0)
  const pageTop = pageIndex * pageSize.height
  return {
    pageIndex,
    y: documentY - pageTop,
    documentY
  }
}

export const buildPaperLayoutPages = (
  items: PaperLayoutCanvasItemType[],
  pageSize: PaperLayoutPageSizeType
): PaperLayoutPageType[] => {
  if (items.length === 0) return []
  const pageCount = Math.max(
    ...items.map((item) =>
      Math.max(
        Math.ceil((getPaperItemDocumentY(item, pageSize) + item.height) / pageSize.height),
        1
      )
    )
  )

  return Array.from({ length: pageCount }, (_, index) => ({
    index,
    // 同一张图片跨页时会在相邻页面生成多个渲染片段，页面 overflow 负责裁切不可见部分。
    items: items
      .map<PaperLayoutRenderItemType | null>((item) => {
        const documentY = getPaperItemDocumentY(item, pageSize)
        const pageTop = index * pageSize.height
        const pageBottom = pageTop + pageSize.height
        const itemTop = documentY
        const itemBottom = documentY + item.height
        const intersectsPage = itemBottom > pageTop && itemTop < pageBottom

        if (!intersectsPage) return null

        return {
          ...item,
          documentY,
          pageIndex: index,
          y: documentY - pageTop,
          localY: documentY - pageTop
        }
      })
      .filter((item): item is PaperLayoutRenderItemType => Boolean(item))
      .sort((first, second) => first.zIndex - second.zIndex)
  }))
}

/**
 * 新增附件按当前停留页生成初始坐标，只安排新增项，不重排用户已经手动调整过的图片。
 */
export const placePaperItemsOnPage = (
  items: PaperLayoutCanvasItemType[],
  pageIndex: number,
  metrics: PaperLayoutPagePlacementMetricsType,
  startZIndex: number
): PaperLayoutCanvasItemType[] => {
  let currentY = metrics.margin
  let cursorX = metrics.margin
  let rowItemCount = 0
  let rowHeight = 0
  const contentHeight = metrics.pageSize.height - metrics.margin * 2

  return items.map((item, index) => {
    const imageHeight = metrics.columnWidth * (item.naturalHeight / item.naturalWidth)
    const fitScale = imageHeight > contentHeight ? contentHeight / imageHeight : 1
    const width = metrics.columnWidth * fitScale
    const height = imageHeight * fitScale

    if (rowItemCount >= metrics.columns) {
      rowItemCount = 0
      cursorX = metrics.margin
      currentY += rowHeight + metrics.gap
      rowHeight = 0
    }

    const documentY = pageIndex * metrics.pageSize.height + currentY
    const placedItem = {
      ...item,
      pageIndex,
      x: cursorX,
      y: currentY,
      documentY,
      width,
      height,
      zIndex: startZIndex + index
    }

    rowItemCount += 1
    cursorX += width + metrics.gap
    rowHeight = Math.max(rowHeight, height)
    return placedItem
  })
}

/**
 * 自动排版按“从左到右、从上到下、超出即分页”的规则放置图片。
 * 图片始终保持原始宽高比；单张图片高于内容区时，会先缩小到当前页可容纳的高度。
 */
export const arrangePaperItems = (
  items: PaperLayoutCanvasItemType[],
  metrics: PaperLayoutMetricsType
): PaperLayoutCanvasItemType[] => {
  let pageIndex = 0
  let currentY = metrics.margin
  let cursorX = metrics.margin
  let rowItemCount = 0
  let rowHeight = 0

  return items.map((item, index) => {
    const imageHeight = metrics.columnWidth * (item.naturalHeight / item.naturalWidth)
    const fitScale = imageHeight > metrics.contentHeight ? metrics.contentHeight / imageHeight : 1
    const width = metrics.columnWidth * fitScale
    const height = imageHeight * fitScale

    if (rowItemCount >= metrics.columns) {
      rowItemCount = 0
      cursorX = metrics.margin
      currentY += rowHeight + metrics.gap
      rowHeight = 0
    }

    if (currentY > metrics.margin && currentY + height > metrics.pageSize.height - metrics.margin) {
      pageIndex += 1
      rowItemCount = 0
      cursorX = metrics.margin
      currentY = metrics.margin
      rowHeight = 0
    }

    const arrangedItem = {
      ...item,
      pageIndex,
      x: cursorX,
      y: currentY,
      documentY: pageIndex * metrics.pageSize.height + currentY,
      width,
      height,
      zIndex: index + 1
    }

    rowItemCount += 1
    cursorX += width + metrics.gap
    rowHeight = Math.max(rowHeight, height)
    return arrangedItem
  })
}

/**
 * 允许图片少量移出页面，方便做贴边裁切；但至少保留一块可见区域，
 * 否则用户无法再次选中和拖回画布。
 */
export const clampPaperItemPosition = (
  item: PaperLayoutCanvasItemType,
  position: { x: number; documentY: number },
  options: {
    pageSize: PaperLayoutPageSizeType
    minVisibleMm: number
  }
): { x: number; documentY: number } => {
  const minDocumentY = -item.height + options.minVisibleMm

  return {
    x: Math.min(
      Math.max(position.x, -item.width + options.minVisibleMm),
      options.pageSize.width - options.minVisibleMm
    ),
    documentY: Math.max(position.documentY, minDocumentY)
  }
}
