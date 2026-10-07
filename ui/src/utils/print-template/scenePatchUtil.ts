import { resolveCardLayerText } from './cardTextUtil'
import { resolveSceneAssets } from './sceneDomUtil'

import type { CardLayerType, CardTemplateType } from '@/types/PrintTools'

const pixels = (pt: number): number => ((pt * 25.4) / 72) * 6

/** 只写入实际编辑过的属性，默认素材的描边、阴影及子像素位置保持原样。 */
export function applySceneLayer(
  element: HTMLElement,
  layer: CardLayerType,
  template: CardTemplateType,
  fields: Record<string, string>
): void {
  const base = layer.scene?.base
  if (layer.hidden) element.style.visibility = 'hidden'
  if (layer.kind === 'text') element.textContent = resolveCardLayerText(layer, fields)
  else if (layer.image && layer.image !== base?.image)
    element.setAttribute('src', resolveSceneAssets(layer.image, template.scene!))
  if (
    layer.kind === 'image' &&
    base &&
    (layer.width !== base.width || layer.height !== base.height || layer.image !== base.image)
  )
    element.style.objectFit = 'contain'
  if (!base) return
  if (layer.x !== base.x || layer.y !== base.y)
    element.style.transform = `translate(${(layer.x - base.x) * 6}px, ${(layer.y - base.y) * 6}px) ${element.style.transform === 'none' ? '' : element.style.transform}`
  if (layer.width !== base.width) element.style.width = `${layer.width * 6}px`
  if (layer.height !== base.height) element.style.height = `${layer.height * 6}px`
  if (layer.fontSize !== base.fontSize) element.style.fontSize = `${pixels(layer.fontSize)}px`
  if (layer.fontFamily !== base.fontFamily)
    element.style.fontFamily = layer.fontFamily || 'sans-serif'
  if (layer.color !== base.color) element.style.color = layer.color
  if (layer.bold !== base.bold) element.style.fontWeight = layer.bold ? '700' : '400'
  if (layer.align !== base.align) element.style.textAlign = layer.align
  if (layer.lineHeight !== base.lineHeight)
    element.style.lineHeight = String(layer.lineHeight || 1.4)
  if (layer.letterSpacing !== base.letterSpacing)
    element.style.letterSpacing = `${pixels(layer.letterSpacing || 0)}px`
  if (layer.singleLine !== base.singleLine)
    element.style.whiteSpace = layer.singleLine ? 'nowrap' : 'pre-wrap'
  if (layer.strokeWidth !== base.strokeWidth || layer.strokeColor !== base.strokeColor)
    element.style.webkitTextStroke = `${pixels(layer.strokeWidth || 0)}px ${layer.strokeColor || layer.color}`
  if (
    (['shadowColor', 'shadowBlur', 'shadowX', 'shadowY'] as const).some(
      (key) => layer[key] !== base[key]
    )
  )
    element.style.textShadow = `${pixels(layer.shadowX || 0)}px ${pixels(layer.shadowY || 0)}px ${pixels(layer.shadowBlur || 0)}px ${layer.shadowColor || 'transparent'}`
}
