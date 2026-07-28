import domtoimage from 'dom-to-image'
import { PDFDocument } from 'pdf-lib'

import { PagesEnum } from '@/types/Common'
import { getPageSize } from '@/utils/pageSizeInPixelUntil'

export type DutyRosterExportFormatType = 'png' | 'pdf'

export interface DutyRosterPdfOptionsType {
  imageBlob: Blob
  pageType: PagesEnum
}

export function sanitizeDutyRosterFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || '值日表'
}

export function formatDutyRosterExportDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function renderDutyRosterPngBlob(element: HTMLElement, scale = 2): Promise<Blob> {
  await document.fonts?.ready
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (!width || !height) throw new Error('值日表预览尚未准备完成')
  const dataUrl = await domtoimage.toPng(element, {
    quality: 1,
    bgcolor: '#f4f0e8',
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    style: {
      transform: `scale(${scale})`,
      transformOrigin: '0 0'
    }
  })
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('值日表图片生成失败')
  return await response.blob()
}

/**
 * 将纸张预览生成的 PNG 铺满嵌入 PDF，保证两种导出格式版式一致。
 */
export async function createDutyRosterPdf(options: DutyRosterPdfOptionsType): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()
  const imageBytes = new Uint8Array(await options.imageBlob.arrayBuffer())
  const image = await pdfDoc.embedPng(imageBytes)
  const pageSize = getPageSize(options.pageType, 'landscape')
  const page = pdfDoc.addPage([pageSize.width, pageSize.height])
  page.drawImage(image, { x: 0, y: 0, width: pageSize.width, height: pageSize.height })
  const bytes = await pdfDoc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export function downloadDutyRosterBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
