import { resolveCardLayerText } from './cardTextUtil'
import { resolveSceneAssets } from './sceneDomUtil'

import type { CardLayerType, CardTemplateType } from '@/types/PrintTools'

/** pt 转为素材原始像素；毫米坐标始终按 6 像素/毫米保存。 */
export const scenePixels = (pt: number): number => ((pt * 25.4) / 72) * 6

/** 普通新增图层也可加入素材树，不需要再次调用原页面渲染器。 */
export function createExtraSceneLayer(
  layer: CardLayerType,
  template: CardTemplateType,
  fields: Record<string, string>
): HTMLElement {
  const node = document.createElement(layer.kind === 'image' ? 'img' : 'div')
  node.dataset.printExtra = layer.id
  Object.assign(node.style, {
    position: 'absolute',
    left: `${layer.x * 6}px`,
    top: `${layer.y * 6}px`,
    width: `${layer.width * 6}px`,
    height: `${layer.height * 6}px`,
    boxSizing: 'border-box',
    margin: '0',
    padding: '0',
    overflow: 'visible',
    visibility: layer.hidden ? 'hidden' : 'visible'
  })
  if (layer.kind === 'image') {
    const source = template.scene ? resolveSceneAssets(layer.image, template.scene) : layer.image
    if (source) node.setAttribute('src', source)
    node.style.objectFit = 'contain'
  } else {
    node.textContent = resolveCardLayerText(layer, fields)
    Object.assign(node.style, {
      fontFamily: layer.fontFamily || '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: `${scenePixels(layer.fontSize)}px`,
      fontWeight: layer.bold ? '700' : '400',
      color: layer.color,
      textAlign: layer.align,
      lineHeight: String(layer.lineHeight || 1.4),
      whiteSpace: layer.singleLine ? 'nowrap' : 'pre-wrap',
      letterSpacing: `${scenePixels(layer.letterSpacing || 0)}px`,
      webkitTextStroke: `${scenePixels(layer.strokeWidth || 0)}px ${layer.strokeColor || layer.color}`,
      textShadow: `${scenePixels(layer.shadowX || 0)}px ${scenePixels(layer.shadowY || 0)}px ${scenePixels(layer.shadowBlur || 0)}px ${layer.shadowColor || 'transparent'}`
    })
  }
  return node
}
