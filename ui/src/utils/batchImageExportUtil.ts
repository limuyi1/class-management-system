import { PDFDocument, clip, endPath, popGraphicsState, pushGraphicsState, rectangle } from 'pdf-lib'

import type { ZipEntryType } from '@/utils/zipUtil'

/** 根据 A4 可打印区域按宽度缩放，长报告分成连续页面，不缩小正文字号。 */
export function getReportPdfLayout(
  width: number,
  height: number
): {
  scale: number
  pageCount: number
  contentHeight: number
} {
  if (width <= 0 || height <= 0) throw new Error('报告图片尺寸无效')
  const scale = (595.28 - 36) / width
  const contentHeight = 841.89 - 48
  return { scale, pageCount: Math.ceil((height * scale) / contentHeight), contentHeight }
}

/** 每名学生从新页开始；复用整幅图片并按页裁切，确保内容完整且学生边界明确。 */
export async function createBatchImagePdf(entries: ZipEntryType[]): Promise<Blob> {
  if (!entries.length) throw new Error('没有已生成的图片')
  const pdf = await PDFDocument.create()
  for (const entry of entries) {
    const bytes = entry.data instanceof Blob ? await entry.data.arrayBuffer() : entry.data
    const image = await pdf.embedPng(bytes)
    const { scale, pageCount, contentHeight } = getReportPdfLayout(image.width, image.height)
    for (let index = 0; index < pageCount; index++) {
      const page = pdf.addPage([595.28, 841.89])
      // 可打印区域作为裁切窗口，后续页向上平移同一张图片，避免遗漏底部正文。
      page.pushOperators(
        pushGraphicsState(),
        rectangle(18, 30, 559.28, contentHeight),
        clip(),
        endPath()
      )
      page.drawImage(image, {
        x: 18,
        y: 841.89 - 18 - image.height * scale + index * contentHeight,
        width: image.width * scale,
        height: image.height * scale
      })
      page.pushOperators(popGraphicsState())
      page.drawText(`${index + 1} / ${pageCount}`, { x: 280, y: 12, size: 9 })
    }
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' })
}
