/**
 * 座位表导出工具
 * 负责将座位表预览渲染为高清 PNG 并导出为 PNG/PDF 文件
 */
import { downloadBlob, formatExportDate, sanitizeExportFileName } from '@/utils/downloadUtil'
import { renderDomPngBlob } from '@/utils/domImageUtil'
import { createImagePdf } from '@/utils/imagePdfUtil'
import { PagesEnum } from '@/types/Common'
import { getSeatingChartPageSize } from '@/utils/seating-chart/seatingChartPageLayoutUtil'

import type { SeatingChartPageOrientationType } from '@/utils/seating-chart/seatingChartPageLayoutUtil'

/** 座位表导出格式：PNG、PDF 或 Excel */
export type SeatingChartExportFormatType = 'png' | 'pdf' | 'xlsx'

/** PDF 导出所需参数：纸张预览生成的图片及纸张设置 */
export interface SeatingChartPdfOptionsType {
  imageBlob: Blob
  pageType: PagesEnum
  orientation: SeatingChartPageOrientationType
}

/** 清理文件名中的非法字符，空名称回退为"座位表" */
export function sanitizeSeatingChartFileName(value: string): string {
  return sanitizeExportFileName(value, '座位表')
}

/** 将日期格式化为 YYYY-MM-DD，用于文件名 */
export function formatSeatingChartExportDate(date: Date = new Date()): string {
  return formatExportDate(date)
}

/**
 * 按纸张节点的自然尺寸生成高清 PNG，避免受到屏幕预览缩放状态影响。
 * @param element - 要渲染的纸张预览节点
 * @param scale - 导出倍率
 * @returns 生成的 PNG Blob
 */
export async function renderSeatingChartPngBlob(element: HTMLElement, scale = 2): Promise<Blob> {
  return renderDomPngBlob(element, scale, '#f4f0e8', '座位表')
}

/**
 * 将已经按纸张渲染的 PNG 铺满嵌入 PDF，确保图片与 PDF 的版式完全一致。
 * @param options - PDF 导出参数
 * @returns 生成的 PDF Blob
 */
export async function createSeatingChartPdf(options: SeatingChartPdfOptionsType): Promise<Blob> {
  return createImagePdf(
    options.imageBlob,
    getSeatingChartPageSize(options.pageType, options.orientation)
  )
}

/** 触发浏览器下载指定 Blob，并延迟释放对象 URL 避免下载被中断 */
export function downloadSeatingChartBlob(blob: Blob, fileName: string): void {
  downloadBlob(blob, fileName)
}
