import { getPdfPageSize } from '@/utils/evaluationPdfLayoutUntil'

import type {
  AttachmentRecordType,
  PaperLayoutCanvasItemType,
  PaperLayoutPageType,
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
  width: options.columnWidth,
  height: options.columnWidth * (attachment.height / attachment.width),
  zIndex: options.index + 1
})

export const buildPaperLayoutPages = (
  items: PaperLayoutCanvasItemType[]
): PaperLayoutPageType[] => {
  if (items.length === 0) return []
  const pageCount = Math.max(...items.map((item) => item.pageIndex)) + 1

  return Array.from({ length: pageCount }, (_, index) => ({
    index,
    // 同页内按 zIndex 渲染，保证预览顺序和 PDF 导出顺序一致。
    items: items
      .filter((item) => item.pageIndex === index)
      .sort((first, second) => first.zIndex - second.zIndex)
  }))
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
  position: { x: number; y: number },
  options: {
    pageSize: PaperLayoutPageSizeType
    minVisibleMm: number
  }
): { x: number; y: number } => ({
  x: Math.min(
    Math.max(position.x, -item.width + options.minVisibleMm),
    options.pageSize.width - options.minVisibleMm
  ),
  y: Math.min(
    Math.max(position.y, -item.height + options.minVisibleMm),
    options.pageSize.height - options.minVisibleMm
  )
})
