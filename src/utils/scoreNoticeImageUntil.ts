import domtoimage from 'dom-to-image'

import { getEvaluationHandwriteFontDataUrl } from '@/utils/evaluationHandwriteFontUntil'

export const sanitizeFileName = (value: string): string => {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || '成绩通知'
}

/**
 * 将 DOM 预览渲染为 PNG。
 *
 * 导出前临时注入手写字体，确保图片与页面预览一致；SVG 生成完毕后立即清除样式，避免污染全局 DOM。
 */
export const renderScoreNoticeBlob = async (element: HTMLElement, scale = 2): Promise<Blob> => {
  await document.fonts?.ready
  const width = element.offsetWidth
  const height = element.offsetHeight
  const fontStyle = document.createElement('style')
  const handwriteFontDataUrl = await getEvaluationHandwriteFontDataUrl()
  fontStyle.textContent = `@font-face { font-family: EvaluationHandwriteFont; src: url("${handwriteFontDataUrl}"); }`
  document.head.appendChild(fontStyle)

  let svgDataUrl = ''
  try {
    svgDataUrl = await domtoimage.toSvg(element, {
      bgcolor: '#fdfbf5',
      width,
      height
    })
  } finally {
    fontStyle.remove()
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image()
    nextImage.onload = () => resolve(nextImage)
    nextImage.onerror = () => reject(new Error('成绩通知 SVG 渲染失败'))
    nextImage.src = svgDataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建成绩通知导出画布')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('图片生成失败')
  return blob
}

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const copyPngBlob = async (blob: Blob): Promise<boolean> => {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch (error) {
    console.error('复制成绩通知图片失败:', error)
    return false
  }
}
