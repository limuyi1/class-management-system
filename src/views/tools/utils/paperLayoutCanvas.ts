import { getPdfPageSize } from '@/utils/evaluationPdfLayoutUtil'

import type {
  AttachmentRecordType,
  PaperLayoutCanvasItemType,
  PaperLayoutPageType,
  PaperLayoutRenderItemType,
  PaperLayoutSettingsType
} from '@/types/Tools'

/** 纸张尺寸（毫米） */
export interface PaperLayoutPageSizeType {
  width: number
  height: number
}

/** 自动排版所需的版式指标 */
export interface PaperLayoutMetricsType {
  pageSize: PaperLayoutPageSizeType
  margin: number
  gap: number
  columns: number
  fitMode: PaperLayoutSettingsType['fitMode']
  columnWidth: number
  contentHeight: number
}

/** 图片归一化后的位置信息 */
export interface PaperLayoutPositionType {
  pageIndex: number
  y: number
  documentY: number
}

/** 新增图片分页摆放所需的版式指标 */
export interface PaperLayoutPagePlacementMetricsType {
  pageSize: PaperLayoutPageSizeType
  margin: number
  gap: number
  columns: number
  fitMode: PaperLayoutSettingsType['fitMode']
  columnWidth: number
  contentHeight: number
}

/** 生成试卷排版条目的唯一 ID */
export const createPaperLayoutId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 根据纸张类型与方向计算实际页面尺寸。
 * 横向时交换宽高。
 *
 * @param settings 排版设置
 * @returns 页面尺寸（毫米）
 */
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

/**
 * 将素材转换为画布条目，初始尺寸按列宽等比计算。
 *
 * @param attachment 素材记录
 * @param options 初始坐标、列宽与数据 URL
 * @returns 画布条目
 */
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

/** 计算画布中下一个可用层级（当前最大 zIndex + 1） */
export const getNextPaperLayoutZIndex = (items: PaperLayoutCanvasItemType[]): number => {
  return Math.max(0, ...items.map((item) => item.zIndex)) + 1
}

/** 计算图片在整份文档中的纵向坐标（兼容旧的 pageIndex/y 字段） */
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

/**
 * 将画布条目按页面切分为渲染片段。
 * 跨页图片会在相邻页面生成多个片段，由页面容器裁切显示。
 *
 * @param items 画布条目
 * @param pageSize 页面尺寸
 * @returns 分页后的页面数据
 */
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
  let targetPageIndex = pageIndex
  let currentY = metrics.margin
  let cursorX = metrics.margin
  let rowItemCount = 0
  let rowHeight = 0
  const contentHeight = metrics.pageSize.height - metrics.margin * 2

  return items.map((item, index) => {
    const imageHeight = metrics.columnWidth * (item.naturalHeight / item.naturalWidth)
    // 图片高度超出内容区时按比例缩小，保证完整放入一页
    const fitScale = imageHeight > contentHeight ? contentHeight / imageHeight : 1
    const width = metrics.fitMode === 'slot' ? metrics.columnWidth : metrics.columnWidth * fitScale
    const height = metrics.fitMode === 'slot' ? metrics.contentHeight : imageHeight * fitScale

    if (rowItemCount >= metrics.columns) {
      rowItemCount = 0
      cursorX = metrics.margin
      currentY += rowHeight + metrics.gap
      rowHeight = 0
    }

    if (currentY > metrics.margin && currentY + height > metrics.pageSize.height - metrics.margin) {
      targetPageIndex += 1
      rowItemCount = 0
      cursorX = metrics.margin
      currentY = metrics.margin
      rowHeight = 0
    }

    const documentY = targetPageIndex * metrics.pageSize.height + currentY
    const placedItem = {
      ...item,
      pageIndex: targetPageIndex,
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
 * 满版模式让图片占满目标区域；自由模式按图片原始比例排布。
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
    // 图片高度超出内容区时按比例缩小，保证完整放入一页
    const fitScale = imageHeight > metrics.contentHeight ? metrics.contentHeight / imageHeight : 1
    const width = metrics.fitMode === 'slot' ? metrics.columnWidth : metrics.columnWidth * fitScale
    const height = metrics.fitMode === 'slot' ? metrics.contentHeight : imageHeight * fitScale

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
