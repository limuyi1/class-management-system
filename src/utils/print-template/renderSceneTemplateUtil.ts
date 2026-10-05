import { loadPrintImage } from '@/utils/printCanvasUtil'
import { renderDomPngBlob } from '@/utils/domImageUtil'
import { waitForPrintReady } from '@/utils/printDomUtil'
import { createCardPaperDom, getCardPaperWarnings } from './cardPaperDomUtil'

import type { CardTemplateType, PrintCanvasPageType } from '@/types/PrintTools'

/** 仅在显式导出时挂载同一 DOM 纸张并生成图片；普通预览不调用此函数。 */
export async function renderSceneTemplate(
  template: CardTemplateType,
  fields: Record<string, string>,
  pixelRatio = 1
): Promise<{ page: PrintCanvasPageType; warnings: string[] }> {
  const paper = createCardPaperDom(template, fields)
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none'
  host.appendChild(paper.root)
  document.body.appendChild(host)
  try {
    await waitForPrintReady(paper.root)
    const warnings = getCardPaperWarnings(paper.root, template, fields)
    let image: HTMLImageElement
    if (template.scene) {
      // 捕获素材已内嵌计算样式与字体，直接序列化以保留原通知的子像素边缘。
      const xhtml = new XMLSerializer().serializeToString(paper.root)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width * 6}" height="${template.height * 6}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`
      image = await loadPrintImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    } else {
      const blob = await renderDomPngBlob(paper.root, pixelRatio, '#ffffff', '奖状卡片')
      const url = URL.createObjectURL(blob)
      try {
        image = await loadPrintImage(url)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(template.width * 6 * pixelRatio)
    canvas.height = Math.round(template.height * 6 * pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法导出图片')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { page: { canvas, width: template.width, height: template.height }, warnings }
  } finally {
    host.remove()
  }
}
