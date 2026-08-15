import domtoimage from 'dom-to-image'
import { PDFDocument } from 'pdf-lib'

import { PagesEnum } from '@/types/Common'
import { getSeatingChartPageSize } from '@/utils/seatingChartPageLayoutUtil'

import type { SeatingChartPageOrientationType } from '@/utils/seatingChartPageLayoutUtil'

/** 座位表导出格式：PNG 或 PDF */
export type SeatingChartExportFormatType = 'png' | 'pdf'

/** PDF 导出所需参数：纸张预览生成的图片及纸张设置 */
export interface SeatingChartPdfOptionsType {
  imageBlob: Blob
  pageType: PagesEnum
  orientation: SeatingChartPageOrientationType
}

/** 清理文件名中的非法字符，空名称回退为"座位表" */
export function sanitizeSeatingChartFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || '座位表'
}

/** 将日期格式化为 YYYY-MM-DD，用于文件名 */
export function formatSeatingChartExportDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 按纸张节点的自然尺寸生成高清 PNG，避免受到屏幕预览缩放状态影响。
 */
export async function renderSeatingChartPngBlob(element: HTMLElement, scale = 2): Promise<Blob> {
  await document.fonts?.ready
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (!width || !height) throw new Error('座位表预览尚未准备完成')

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
  if (!response.ok) throw new Error('座位表图片生成失败')
  return await response.blob()
}

/**
 * 将已经按纸张渲染的 PNG 铺满嵌入 PDF，确保图片与 PDF 的版式完全一致。
 */
export async function createSeatingChartPdf(options: SeatingChartPdfOptionsType): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()
  const imageBytes = new Uint8Array(await options.imageBlob.arrayBuffer())
  const image = await pdfDoc.embedPng(imageBytes)
  const pageSize = getSeatingChartPageSize(options.pageType, options.orientation)
  const page = pdfDoc.addPage([pageSize.width, pageSize.height])

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pageSize.width,
    height: pageSize.height
  })

  const bytes = await pdfDoc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

/** 触发浏览器下载指定 Blob，并延迟释放对象 URL 避免下载被中断 */
export function downloadSeatingChartBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
