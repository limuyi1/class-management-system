import type { PrintTemplateNodeType, PrintTemplateSceneType } from '@/types/PrintTemplateScene'

const HTML_TAGS = new Set([
  'article',
  'header',
  'footer',
  'main',
  'small',
  'b',
  'em',
  'section',
  'div',
  'span',
  'strong',
  'p',
  'h1',
  'h2',
  'h3',
  'i',
  'img',
  'style'
])
const SVG_TAGS = new Set([
  'svg',
  'path',
  'g',
  'defs',
  'clipPath',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'line',
  'polyline'
])
const ATTRIBUTES = new Set([
  'class',
  'style',
  'src',
  'alt',
  'width',
  'height',
  'viewBox',
  'd',
  'fill',
  'stroke',
  'stroke-width',
  'transform',
  'xmlns',
  'preserveAspectRatio',
  'fill-rule',
  'clip-rule',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'points',
  'opacity'
])

/** 将自有导出 DOM 转为纯数据；文本作为文本节点，不经过 innerHTML。 */
export function serializePrintNode(node: Node): PrintTemplateNodeType {
  if (node.nodeType === Node.TEXT_NODE)
    return { tag: '#text', text: node.textContent || '', attributes: {}, children: [] }
  const element = node as Element
  return {
    tag: element.localName,
    attributes: Object.fromEntries(
      Array.from(element.attributes)
        .filter((item) => ATTRIBUTES.has(item.name))
        .map((item) => [item.name, item.value])
    ),
    children: Array.from(element.childNodes)
      .filter((item) => item.nodeType === Node.TEXT_NODE || item.nodeType === Node.ELEMENT_NODE)
      .map(serializePrintNode),
    id: element.getAttribute('data-print-node') || undefined
  }
}

/** 恢复素材引用；只允许内嵌素材，阻止备份中的远程 URL 或脚本伪装。 */
export function resolveSceneAssets(value: string, scene: PrintTemplateSceneType): string {
  return value.replace(/asset:([\w-]+)/g, (_, id: string) => scene.assets[id] || '')
}

/** 白名单重建文档，不执行事件属性、脚本、外链样式或任意 HTML。 */
export function createPrintSceneNode(
  node: PrintTemplateNodeType,
  scene: PrintTemplateSceneType
): Node {
  if (node.tag === '#text') return document.createTextNode(node.text || '')
  if (!HTML_TAGS.has(node.tag) && !SVG_TAGS.has(node.tag))
    throw new Error(`模板包含不支持的文档节点：${node.tag}`)
  const element = SVG_TAGS.has(node.tag)
    ? document.createElementNS('http://www.w3.org/2000/svg', node.tag)
    : document.createElement(node.tag)
  for (const [key, value] of Object.entries(node.attributes)) {
    if (!ATTRIBUTES.has(key)) continue
    const resolved = resolveSceneAssets(value, scene)
    if (
      (key === 'src' && !resolved.startsWith('data:image/')) ||
      (key === 'style' &&
        Array.from(resolved.matchAll(/url\(["']?([^)'"]+)/g)).some(
          (match) => !match[1].startsWith('data:')
        ))
    )
      continue
    element.setAttribute(key, resolved)
  }
  if (node.id) element.setAttribute('data-print-node', node.id)
  for (const child of node.children) element.appendChild(createPrintSceneNode(child, scene))
  if (node.tag === 'style') {
    const css = resolveSceneAssets(element.textContent || '', scene)
    if (/@import|javascript:|expression\(/i.test(css)) throw new Error('模板包含不安全的样式')
    element.textContent = css
  }
  return element
}
