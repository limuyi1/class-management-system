import { PDFDocument } from 'pdf-lib'

/** 将 PNG 铺满指定纸张（单位：点），保持预览图片与 PDF 版式一致。 */
export async function createImagePdf(
  imageBlob: Blob,
  pageSize: { width: number; height: number }
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()
  const imageBytes = new Uint8Array(await imageBlob.arrayBuffer())
  const image = await pdfDoc.embedPng(imageBytes)
  const page = pdfDoc.addPage([pageSize.width, pageSize.height])
  page.drawImage(image, { x: 0, y: 0, width: pageSize.width, height: pageSize.height })
  const bytes = await pdfDoc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
