import { PDFDocument } from 'pdf-lib'

import type { ZipEntryType } from '@/utils/zipUtil'

/** 每名学生单独一张 A4 横向纸，按实际图片比例适应页面，长评语也不会被裁掉。 */
export async function createScoreNoticePdf(entries: ZipEntryType[]): Promise<Blob> {
  if (!entries.length) throw new Error('没有可导出的通知')
  const pdf = await PDFDocument.create()
  const width = (297 * 72) / 25.4,
    height = (210 * 72) / 25.4
  for (const entry of entries) {
    const image = await pdf.embedPng(
      entry.data instanceof Blob ? await entry.data.arrayBuffer() : entry.data
    )
    const scale = Math.min((width - 36) / image.width, (height - 36) / image.height)
    const page = pdf.addPage([width, height])
    page.drawImage(image, {
      x: (width - image.width * scale) / 2,
      y: (height - image.height * scale) / 2,
      width: image.width * scale,
      height: image.height * scale
    })
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' })
}
