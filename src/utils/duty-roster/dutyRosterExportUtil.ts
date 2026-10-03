/**
 * 值日表导出工具
 * 负责将值日表预览渲染为高清 PNG 并导出为 PNG/PDF 文件
 */
import { downloadBlob, formatExportDate, sanitizeExportFileName } from '@/utils/downloadUtil'
import { renderDomPngBlob } from '@/utils/domImageUtil'
import { createImagePdf } from '@/utils/imagePdfUtil'
import { PagesEnum } from '@/types/Common'
import { getPageSize } from '@/utils/pageSizeInPixelUtil'

/** 值日表导出格式：PNG、PDF 或 Excel */
export type DutyRosterExportFormatType = 'png' | 'pdf' | 'xlsx'

/** 值日表 PDF 导出所需参数 */
export interface DutyRosterPdfOptionsType {
  imageBlob: Blob
  pageType: PagesEnum
}

/** 清理文件名中的非法字符，空名称回退为"值日表" */
export function sanitizeDutyRosterFileName(value: string): string {
  return sanitizeExportFileName(value, '值日表')
}

/** 将日期格式化为 YYYY-MM-DD，用于文件名 */
export function formatDutyRosterExportDate(date: Date = new Date()): string {
  return formatExportDate(date)
}

/**
 * 按纸张节点的自然尺寸生成高清 PNG，避免受到屏幕预览缩放状态影响。
 * @param element - 要渲染的纸张预览节点
 * @param scale - 导出倍率
 * @returns 生成的 PNG Blob
 */
export async function renderDutyRosterPngBlob(element: HTMLElement, scale = 2): Promise<Blob> {
  return renderDomPngBlob(element, scale, '#f4f0e8', '值日表')
}

/**
 * 将纸张预览生成的 PNG 铺满嵌入 PDF，保证两种导出格式版式一致。
 * @param options - PDF 导出参数
 * @returns 生成的 PDF Blob
 */
export async function createDutyRosterPdf(options: DutyRosterPdfOptionsType): Promise<Blob> {
  return createImagePdf(options.imageBlob, getPageSize(options.pageType, 'landscape'))
}

/** 触发浏览器下载指定 Blob，并延迟释放对象 URL 避免下载被中断 */
export function downloadDutyRosterBlob(blob: Blob, fileName: string): void {
  downloadBlob(blob, fileName)
}
