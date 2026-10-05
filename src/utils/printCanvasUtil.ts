import { PDFDocument } from 'pdf-lib'

import { downloadBlob, sanitizeExportFileName } from '@/utils/downloadUtil'

import type { PrintCanvasPageType } from '@/types/PrintTools'

export const PRINT_FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

/** 使用毫米坐标创建打印画布，系统字体由浏览器栅格化。 */
export function createPrintCanvas(width: number, height: number, density = 6): PrintCanvasPageType {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * density)
  canvas.height = Math.ceil(height * density)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法生成打印画布')
  context.scale(density, density)
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  return { canvas, width, height }
}

/** 在限定宽度内完整显示单行文字；尺寸和字号均为毫米。 */
export function drawPrintText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 3.5,
  align: CanvasTextAlign = 'left',
  bold = false
): void {
  context.font = `${bold ? 'bold ' : ''}${size}px ${PRINT_FONT}`
  const measured = context.measureText(value).width
  if (measured > width)
    context.font = `${bold ? 'bold ' : ''}${(size * width) / measured}px ${PRINT_FONT}`
  context.textAlign = align
  context.textBaseline = 'middle'
  context.fillStyle = '#222'
  context.fillText(value, align === 'center' ? x + width / 2 : align === 'right' ? x + width : x, y)
}

/** 画布转 PNG；失败明确抛错，避免生成空文件。 */
export function printCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('图片生成失败'))), 'image/png')
  )
}

/** 多页画布按真实毫米尺寸合并为 PDF。 */
export async function createPrintPdf(pages: PrintCanvasPageType[]): Promise<Blob> {
  if (!pages.length) throw new Error('没有可导出的页面')
  const pdf = await PDFDocument.create()
  for (const item of pages) {
    const blob = await printCanvasBlob(item.canvas)
    const image = await pdf.embedPng(await blob.arrayBuffer())
    const width = (item.width * 72) / 25.4
    const height = (item.height * 72) / 25.4
    const page = pdf.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' })
}

/** 下载与打印预览一致的 PDF。 */
export async function downloadPrintPdf(pages: PrintCanvasPageType[], name: string): Promise<void> {
  downloadBlob(await createPrintPdf(pages), `${sanitizeExportFileName(name, '打印文档')}.pdf`)
}

/** 读取本地图片，decode 完成后才能参与导出。 */
export async function loadPrintImage(source: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = source
  await image.decode()
  return image
}
