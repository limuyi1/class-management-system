import { createCardPaperFrame } from './cardPaperFrameUtil'
import { resolveCardLayerText } from './cardTextUtil'
import { createPrintSceneNode } from './sceneDomUtil'
import { applySceneLayer } from './scenePatchUtil'
import { createExtraSceneLayer } from './sceneLayerStyleUtil'

import type { CardTemplateType } from '@/types/PrintTools'

/** 纸张保留原素材节点，属性更新从初始样式计算，防止拖动位移累加或撤销后残留。 */
export function createCardPaperDom(template: CardTemplateType, fields: Record<string, string>) {
  if (template.scene && template.scene.version !== 1) throw new Error('模板版本暂不支持')
  const root = template.scene
    ? (createPrintSceneNode(template.scene.root, template.scene) as HTMLElement)
    : document.createElement('article')
  if (!template.scene) {
    root.style.cssText =
      'position:relative;background:white;overflow:hidden;margin:0;padding:0;box-sizing:border-box;color:#333'
  }
  const originals = Array.from(root.querySelectorAll<HTMLElement>('[data-print-node]')).map(
    (node) => ({ node, style: node.getAttribute('style') || '', src: node.getAttribute('src') })
  )
  const background = template.scene
    ? root.querySelector<HTMLImageElement>('.score-report__paper')
    : document.createElement('img')
  const originalBackground = background?.getAttribute('src') || ''
  const originalFit = background?.style.objectFit || ''
  if (background && !template.scene) {
    background.alt = ''
    background.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
  }
  let frame: HTMLElement | null = null
  let frameKey = ''
  const extras = new Map<string, HTMLElement>()
  /** 就地修改文字和图层样式；字体资源和通知结构仅在切换模板时构建。 */
  function update(next: CardTemplateType, values: Record<string, string>): void {
    root.style.width = `${next.width * 6}px`
    root.style.height = `${next.height * 6}px`
    root.style.minHeight = '0'
    const layers = new Map(
      next.layers.filter((layer) => layer.scene).map((layer) => [layer.scene!.nodeId, layer])
    )
    for (const original of originals) {
      original.node.setAttribute('style', original.style)
      const layer = layers.get(original.node.dataset.printNode || '')
      if (
        original.src !== null &&
        (!layer || layer.image === layer.scene?.base.image) &&
        original.node.getAttribute('src') !== original.src
      )
        original.node.setAttribute('src', original.src)
      if (!layer) original.node.style.visibility = 'hidden'
      else applySceneLayer(original.node, layer, next, values)
    }
    if (background) {
      const source = next.background || originalBackground
      if (background.getAttribute('src') !== source) {
        if (source) background.src = source
        else background.removeAttribute('src')
      }
      if (!next.scene) {
        if (source) root.prepend(background)
        else background.remove()
      }
      background.style.visibility = source ? 'visible' : 'hidden'
      background.style.objectFit = next.background ? next.backgroundFit : originalFit
    }
    const key = JSON.stringify([next.frame, next.width, next.height, !!next.scene])
    if (key !== frameKey) {
      frame?.remove()
      frame = createCardPaperFrame(next)
      if (frame) root.appendChild(frame)
      frameKey = key
    }
    const ids = new Set(next.layers.filter((layer) => !layer.scene).map((layer) => layer.id))
    for (const [id, node] of extras) {
      if (!ids.has(id)) {
        node.remove()
        extras.delete(id)
      }
    }
    for (const layer of next.layers.filter((item) => !item.scene)) {
      const fresh = createExtraSceneLayer(layer, next, values)
      let node = extras.get(layer.id)
      if (!node || node.tagName !== fresh.tagName) {
        node?.remove()
        node = fresh
        extras.set(layer.id, node)
      } else {
        node.setAttribute('style', fresh.getAttribute('style') || '')
        if (layer.kind === 'text') node.textContent = fresh.textContent
        else if (node.getAttribute('src') !== fresh.getAttribute('src'))
          node.setAttribute('src', fresh.getAttribute('src') || '')
      }
      root.appendChild(node)
    }
  }
  update(template, fields)
  return { root, update }
}

/** 使用真实文字范围检测裁切；捕获素材允许原有行框溢出，但不能超出纸张。 */
export function getCardPaperWarnings(
  root: HTMLElement,
  template: CardTemplateType,
  fields: Record<string, string>
): string[] {
  const warnings: string[] = []
  const paper = root.getBoundingClientRect()
  for (const layer of template.layers.filter((item) => !item.hidden)) {
    if (
      layer.x < 0 ||
      layer.y < 0 ||
      layer.x + layer.width > template.width + 0.01 ||
      layer.y + layer.height > template.height + 0.01
    )
      warnings.push(`${layer.label} 超出纸张边界`)
    if (layer.kind !== 'text') continue
    const value = resolveCardLayerText(layer, fields)
    if (/\{\{[^{}]+\}\}/.test(value)) warnings.push(`${layer.label} 有未填写的变量`)
    const node = Array.from(
      root.querySelectorAll<HTMLElement>('[data-print-node], [data-print-extra]')
    ).find((item) =>
      layer.scene
        ? item.dataset.printNode === layer.scene.nodeId
        : item.dataset.printExtra === layer.id
    )
    if (!node || !value) continue
    const style = getComputedStyle(node)
    const clipped = style.overflowX !== 'visible' || style.overflowY !== 'visible'
    const overflowing =
      (!layer.scene || clipped) &&
      node.clientWidth > 0 &&
      node.clientHeight > 0 &&
      (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)
    const range = document.createRange()
    range.selectNodeContents(node)
    const text = range.getBoundingClientRect()
    const box = node.getBoundingClientRect()
    const tooWide = layer.singleLine && text.width > box.width + 1
    if (
      overflowing ||
      tooWide ||
      text.bottom > paper.bottom + 1 ||
      text.right > paper.right + 1 ||
      text.left < paper.left - 1 ||
      text.top < paper.top - 1
    )
      warnings.push(`${layer.label} 文字超出文本框，请调整尺寸或字号`)
  }
  return [...new Set(warnings)]
}
