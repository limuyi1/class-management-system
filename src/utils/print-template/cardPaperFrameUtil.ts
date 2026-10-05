import type { CardTemplateType } from '@/types/PrintTools'

/** 原通知的纸框和四角素材独立于文字图层，预览与导出共用同一 DOM 装饰。 */
export function createCardPaperFrame(template: CardTemplateType): HTMLElement | null {
  if (!template.frame || template.scene) return null
  const scale = template.width / 297
  const frame = document.createElement('div')
  frame.dataset.cardFrame = 'true'
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = `position:absolute;inset:0;pointer-events:none;box-sizing:border-box;border:${16 * scale}px solid ${template.frame.color}`
  const inner = document.createElement('div')
  inner.style.cssText = `position:absolute;inset:${18 * scale}px;border:${6 * scale}px double #c79a43;box-shadow:inset 0 0 0 ${2 * scale}px #6f501f,inset 0 0 0 ${8 * scale}px #f3dfac;box-sizing:border-box`
  const second = document.createElement('div')
  second.style.cssText = `position:absolute;inset:${30 * scale}px;border:${2 * scale}px solid #b68a37;outline:1px solid #76551f;outline-offset:${-7 * scale}px;box-sizing:border-box`
  frame.append(inner, second)
  const size = template.width * 6 * 0.09
  for (let index = 0; index < 4; index++) {
    for (const [source, isWatermark] of [
      [template.frame.watermark, true],
      [template.frame.corner, false]
    ] as const) {
      if (!source) continue
      const image = document.createElement('img')
      image.src = source
      image.alt = ''
      const right = index % 2 === 1
      const bottom = index > 1
      const extent = size * (isWatermark ? 2.2 : 1)
      image.style.cssText = `position:absolute;width:${extent}px;height:${extent}px;object-fit:contain;${right ? 'right' : 'left'}:${34 * scale}px;${bottom ? 'bottom' : 'top'}:${34 * scale}px;transform:scale(${right ? -1 : 1},${bottom ? -1 : 1});opacity:${isWatermark ? 0.12 : 1}`
      frame.appendChild(image)
    }
  }
  return frame
}
