/** 纸张尺寸像素换算工具 */
import { PagesEnum } from '@/types/Common'

/** 各纸张在 PDF/layout 坐标系下的尺寸（单位：点 pt） */
const PAGE_SIZE_POINTS: Record<PagesEnum, { width: number; height: number }> = {
  [PagesEnum.A4]: { width: 595.28, height: 841.89 },
  [PagesEnum.A3]: { width: 841.89, height: 1190.55 },
  [PagesEnum.B4]: { width: 708.66, height: 1000.63 },
  [PagesEnum.B3]: { width: 1000.63, height: 1417.32 }
}

/**
 * 获取页面尺寸（点，PDF/layout 坐标系）
 * @param pageType - 纸张类型
 * @param orientation - 方向（portrait/landscape）
 * @returns 宽高尺寸（单位：点 pt）
 */
export function getPageSize(
  pageType: PagesEnum,
  orientation: 'portrait' | 'landscape'
): { width: number; height: number } {
  const portrait = PAGE_SIZE_POINTS[pageType]
  return orientation === 'landscape'
    ? { width: portrait.height, height: portrait.width }
    : { ...portrait }
}

/** 通过临时 1 英寸元素测量屏幕 DPI（每英寸像素数） */
const getDPI = () => {
  const tempDiv = document.createElement('div')
  tempDiv.style.width = '1in'
  tempDiv.style.visibility = 'hidden'
  document.body.appendChild(tempDiv)
  const dpi = tempDiv.offsetWidth
  document.body.removeChild(tempDiv)
  return dpi
}

/** 毫米转像素（保留小数，不做取整） */
const mmToPixelPrecise = (mm: number) => {
  const dpi = getDPI()

  // 1 inch = 25.4 mm
  const inches = mm / 25.4
  return inches * dpi
}

/** 毫米转像素（四舍五入到整数） */
const mmToPixel = (mm: number) => {
  return Math.round(mmToPixelPrecise(mm))
}

/**
 * 获取页面尺寸（像素，按屏幕 DPI 换算）
 * @param pageSize - 纸张类型
 * @returns 宽高像素尺寸
 */
const pageSizeInPixels = (pageSize: PagesEnum): { width: number; height: number } => {
  const pageSizeMap = {
    A3: { width: 297, height: 420 },
    A4: { width: 210, height: 297 },
    B3: { width: 353, height: 500 },
    B4: { width: 250, height: 353 }
  }

  const width_px = mmToPixel(pageSizeMap[pageSize].width)
  const height_px = mmToPixel(pageSizeMap[pageSize].height)

  return { width: width_px, height: height_px }
}

export { pageSizeInPixels, mmToPixel, mmToPixelPrecise, getDPI }
