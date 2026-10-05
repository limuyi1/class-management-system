import domtoimage from 'dom-to-image'

import { waitForPrintReady } from './printDomUtil'

/** 按节点自然尺寸渲染高清 PNG，导出尺寸不受屏幕预览缩放影响。 */
export async function renderDomPngBlob(
  element: HTMLElement,
  scale: number,
  backgroundColor: string,
  scene: string
): Promise<Blob> {
  await waitForPrintReady(element)
  const width = element.offsetWidth
  const height = element.offsetHeight
  if (!width || !height) throw new Error(`${scene}预览尚未准备完成`)

  const dataUrl = await domtoimage.toPng(element, {
    quality: 1,
    // 空素材没有图像资源，避免截图器把当前页面 HTML 当作图片读取。
    filter: (node: Node) => !(node instanceof HTMLImageElement) || !!node.getAttribute('src'),
    bgcolor: backgroundColor,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    style: {
      transform: `scale(${scale})`,
      transformOrigin: '0 0'
    }
  })
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error(`${scene}图片生成失败`)
  return await response.blob()
}
