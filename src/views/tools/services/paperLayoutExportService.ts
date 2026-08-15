import {
  PDFDocument,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  type PDFImage,
  type PDFPage
} from 'pdf-lib'

import type {
  PaperLayoutCanvasItemType,
  PaperLayoutPageType,
  PaperLayoutRenderItemType
} from '@/types/Tools'
import type { PaperLayoutPageSizeType } from '@/views/tools/utils/paperLayoutCanvas'

/** 每毫米对应的 PDF 点（pt）数 */
const pointPerMm = 72 / 25.4

/**
 * 获取并缓存图片的 PDF 嵌入对象。
 * 同一张图片只嵌入一次，避免重复解码、减小体积。
 *
 * @param pdfDoc PDF 文档
 * @param cache 已嵌入图片缓存
 * @param item 画布条目
 * @returns PDF 图片对象
 */
const getEmbeddedImage = async (
  pdfDoc: PDFDocument,
  cache: Map<string, PDFImage>,
  item: PaperLayoutCanvasItemType
): Promise<PDFImage> => {
  const cached = cache.get(item.id)
  if (cached) return cached

  // 同一张图片在导出过程中只嵌入一次，避免重复解码和增大 PDF 体积。
  const imageBytes = await fetch(item.dataUrl).then((response) => response.arrayBuffer())
  const embeddedImage =
    item.mimeType === 'image/jpeg'
      ? await pdfDoc.embedJpg(imageBytes)
      : await pdfDoc.embedPng(imageBytes)
  cache.set(item.id, embeddedImage)
  return embeddedImage
}

/**
 * 将图片按 cover 模式（等比裁剪填充）绘制到指定页面区域。
 *
 * @param page 目标页面
 * @param embeddedImage 已嵌入的图片
 * @param item 渲染片段
 * @param pdfHeight 页面高度（pt）
 */
const drawCoverImage = (
  page: PDFPage,
  embeddedImage: PDFImage,
  item: PaperLayoutRenderItemType,
  pdfHeight: number
): void => {
  const targetX = item.x * pointPerMm
  const targetY = pdfHeight - (item.localY + item.height) * pointPerMm
  const targetWidth = item.width * pointPerMm
  const targetHeight = item.height * pointPerMm
  const imageRatio = item.naturalWidth / item.naturalHeight
  const targetRatio = item.width / item.height

  // 图片与目标区域宽高比不同时按 cover 放大居中，再由 clip 裁掉超出部分
  const drawWidth = imageRatio > targetRatio ? targetHeight * imageRatio : targetWidth
  const drawHeight = imageRatio > targetRatio ? targetHeight : targetWidth / imageRatio
  const drawX = targetX + (targetWidth - drawWidth) / 2
  const drawY = targetY + (targetHeight - drawHeight) / 2

  page.pushOperators(
    pushGraphicsState(),
    rectangle(targetX, targetY, targetWidth, targetHeight),
    clip(),
    endPath()
  )
  page.drawImage(embeddedImage, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight
  })
  page.pushOperators(popGraphicsState())
}

/**
 * 将分页的试卷排版数据导出为 PDF。
 *
 * @param pages 分页数据
 * @param pageSize 页面尺寸（毫米）
 * @returns PDF 文件 Blob
 */
export const exportPaperLayoutPdf = async (
  pages: PaperLayoutPageType[],
  pageSize: PaperLayoutPageSizeType
): Promise<Blob> => {
  const pdfDoc = await PDFDocument.create()
  const cache = new Map<string, PDFImage>()
  const pdfWidth = pageSize.width * pointPerMm
  const pdfHeight = pageSize.height * pointPerMm

  for (const pageData of pages) {
    const page = pdfDoc.addPage([pdfWidth, pdfHeight])
    for (const item of pageData.items) {
      const embeddedImage = await getEmbeddedImage(pdfDoc, cache, item)
      drawCoverImage(page, embeddedImage, item, pdfHeight)
    }
  }

  const bytes = await pdfDoc.save()
  const blobBytes = new Uint8Array(bytes)
  return new Blob([blobBytes], { type: 'application/pdf' })
}
