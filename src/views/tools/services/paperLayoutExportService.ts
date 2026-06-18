import { PDFDocument, type PDFImage } from 'pdf-lib'

import type { PaperLayoutCanvasItemType, PaperLayoutPageType } from '@/types/Tools'
import type { PaperLayoutPageSizeType } from '@/views/tools/utils/paperLayoutCanvas'

const pointPerMm = 72 / 25.4

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
      page.drawImage(embeddedImage, {
        x: item.x * pointPerMm,
        // localY 是当前页内坐标；跨页图片会在多个页面重复绘制，并由 PDF 页面边界裁切。
        y: pdfHeight - (item.localY + item.height) * pointPerMm,
        width: item.width * pointPerMm,
        height: item.height * pointPerMm
      })
    }
  }

  const bytes = await pdfDoc.save()
  const blobBytes = new Uint8Array(bytes)
  return new Blob([blobBytes], { type: 'application/pdf' })
}
