import { renderScoreNoticeSvg } from '@/utils/score-notice/scoreNoticeImageUtil'

import { CardLayerKindEnum } from '@/types/PrintTools'
import { createCardLayer } from '@/utils/cardTemplateUtil'
import { serializePrintNode } from './sceneDomUtil'

import type { CardLayerType, CardTemplateType } from '@/types/PrintTools'

/** 把真实通知转换成通用素材文档；动态内容先替换成变量，图片与字体按内容去重。 */
export async function captureNoticeTemplate(element: HTMLElement): Promise<CardTemplateType> {
  await document.fonts.ready
  await Promise.all(Array.from(element.querySelectorAll('img')).map((image) => image.decode()))
  if (!element.offsetWidth || !element.offsetHeight) throw new Error('通知还未完成渲染')
  const sourceRect = element.getBoundingClientRect()
  const svg = await renderScoreNoticeSvg(element)
  const documentCopy = new DOMParser().parseFromString(
    svg
      .slice(svg.indexOf(',') + 1)
      .replace(/%23/g, '#')
      .replace(/%0A/g, '\n'),
    'image/svg+xml'
  )
  const root = documentCopy.querySelector('foreignObject')?.firstElementChild
  if (!root) throw new Error('通知素材转换失败')
  const layers: CardLayerType[] = []
  const definitions = [
    ['.score-report__title-wrap h1', '标题'],
    ['.score-report__student-name', '姓名'],
    ['.score-report__meta > div:last-child strong', '日期'],
    ['.score-report__subject-name span', '科目'],
    ['.score-report__grade-ring span', '成绩'],
    ['.score-report__grade-caption', '等级描述'],
    ['.score-report__comment-body p', '评语']
  ]
  for (const [selector, field] of definitions) {
    const originals = Array.from(element.querySelectorAll<HTMLElement>(selector))
    Array.from(root.querySelectorAll(selector)).forEach((node, index) => {
      const source = originals[index]
      const box = source.getBoundingClientRect()
      const style = getComputedStyle(source)
      const key = ['科目', '成绩', '等级描述'].includes(field) ? `${field}${index + 1}` : field
      const layer = createCardLayer(CardLayerKindEnum.Text, `{{${key}}}`)
      Object.assign(layer, {
        label: key,
        x: (box.x - sourceRect.x) / 6,
        y: (box.y - sourceRect.y) / 6,
        width: box.width / 6,
        height: box.height / 6,
        fontSize: ((parseFloat(style.fontSize) / 6) * 72) / 25.4,
        fontFamily: style.fontFamily,
        color: style.color,
        bold: parseInt(style.fontWeight) >= 600,
        align:
          style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'right' : 'left',
        lineHeight: parseFloat(style.lineHeight) / parseFloat(style.fontSize) || 1.4,
        letterSpacing: (((parseFloat(style.letterSpacing) || 0) / 6) * 72) / 25.4,
        singleLine: style.whiteSpace === 'nowrap'
      })
      node.textContent = layer.text
      node.setAttribute('data-print-node', layer.id)
      layer.scene = { nodeId: layer.id, base: { ...layer } }
      layers.push(layer)
    })
  }
  const images = Array.from(element.querySelectorAll('img'))
  Array.from(root.querySelectorAll('img')).forEach((node, index) => {
    const source = images[index]
    const box = source.getBoundingClientRect()
    if (!box.width || !box.height) return
    const layer = createCardLayer(CardLayerKindEnum.Image)
    Object.assign(layer, {
      label: source.className.includes('logo')
        ? '校徽'
        : source.className.includes('paper')
          ? '纸张底图'
          : `装饰素材 ${index + 1}`,
      image: node.getAttribute('src') || '',
      x: (box.x - sourceRect.x) / 6,
      y: (box.y - sourceRect.y) / 6,
      width: box.width / 6,
      height: box.height / 6,
      locked: true
    })
    node.setAttribute('data-print-node', layer.id)
    layer.scene = { nodeId: layer.id, base: { ...layer } }
    layers.unshift(layer)
  })
  const assets: Record<string, string> = {}
  const assetIds = new Map<string, string>()
  const remember = (value: string): string => {
    let id = assetIds.get(value)
    if (!id) {
      id = crypto.randomUUID()
      assetIds.set(value, id)
      assets[id] = value
    }
    return `asset:${id}`
  }
  const tree = serializePrintNode(root)
  const rewrite = (value: string): string => value.replace(/data:[^\s"')<>]+/g, remember)
  function deduplicate(node: typeof tree): void {
    for (const key of Object.keys(node.attributes))
      node.attributes[key] = rewrite(node.attributes[key])
    if (node.text) node.text = rewrite(node.text)
    node.children.forEach(deduplicate)
  }
  deduplicate(tree)
  for (const layer of layers)
    if (layer.scene && layer.image) {
      layer.image = remember(layer.image)
      layer.scene.base.image = layer.image
    }
  return {
    id: crypto.randomUUID(),
    name: '原通知素材模板',
    width: element.offsetWidth / 6,
    height: element.offsetHeight / 6,
    background: '',
    backgroundFit: 'contain',
    layers,
    scene: {
      version: 1,
      root: tree,
      assets,
      pixelWidth: element.offsetWidth,
      pixelHeight: element.offsetHeight
    }
  }
}
