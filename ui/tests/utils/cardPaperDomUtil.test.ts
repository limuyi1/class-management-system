import { describe, expect, it, vi } from 'vitest'

import { createCardLayer, createCardTemplate } from '../../src/utils/cardTemplateUtil'
import { createCardPaperDom } from '../../src/utils/print-template/cardPaperDomUtil'
import { CardLayerKindEnum } from '../../src/types/PrintTools'

import type { CardTemplateType } from '../../src/types/PrintTools'

/** 真实通知结构的最小片段，用于验证更新和撤销不改变原布局基准。 */
function sceneTemplate(): CardTemplateType {
  const layer = createCardLayer(CardLayerKindEnum.Text, '{{姓名}}')
  layer.id = 'name'
  layer.scene = { nodeId: 'node-name', base: { ...layer } }
  return {
    ...createCardTemplate('blank'),
    layers: [layer],
    scene: {
      version: 1,
      pixelWidth: 1782,
      pixelHeight: 1260,
      assets: {},
      root: {
        tag: 'article',
        attributes: { style: 'position:relative' },
        children: [
          {
            tag: 'span',
            id: 'node-name',
            attributes: { style: 'transform:rotate(2deg);color:red' },
            children: []
          }
        ]
      }
    }
  }
}

describe('卡片 DOM 持续编辑', () => {
  it('绑定只写文本节点，输入和换学生不截图，不把学生姓名写回表达式', () => {
    const raster = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    const template = createCardTemplate('blank')
    template.layers = [createCardLayer(CardLayerKindEnum.Text, '{{姓名}}：{{成绩}}')]
    const paper = createCardPaperDom(template, { 姓名: '<img src=x>', 成绩: '0' })
    const node = paper.root.querySelector('[data-print-extra]')!
    expect(node.textContent).toBe('<img src=x>：0')
    expect(node.querySelector('img')).toBeNull()
    // 空背景不能挂载无 src 图片，否则截图器会把当前页面当作图片读取。
    expect(paper.root.querySelector('img')).toBeNull()
    paper.update(template, { 姓名: '乙', 成绩: '--' })
    expect(paper.root.querySelector('[data-print-extra]')).toBe(node)
    expect(node.textContent).toBe('乙：--')
    expect(template.layers[0].text).toBe('{{姓名}}：{{成绩}}')
    expect(raster).not.toHaveBeenCalled()
    raster.mockRestore()
  })
  it('拖动与颜色修改就地更新，撤销完整恢复原样式；隐藏和删除可恢复', () => {
    const template = sceneTemplate()
    const paper = createCardPaperDom(template, { 姓名: '甲' })
    const node = paper.root.querySelector<HTMLElement>('[data-print-node]')!
    const original = node.getAttribute('style')
    template.layers[0].x += 10
    template.layers[0].color = '#00ff00'
    paper.update(template, { 姓名: '乙' })
    expect(node.style.transform).toBe('translate(60px, 0px) rotate(2deg)')
    paper.update(template, { 姓名: '丙' })
    expect(node.style.transform).toBe('translate(60px, 0px) rotate(2deg)')
    template.layers[0].x -= 10
    template.layers[0].color = template.layers[0].scene!.base.color
    paper.update(template, { 姓名: '丁' })
    expect(node.getAttribute('style')).toBe(original)
    const layer = template.layers.pop()!
    paper.update(template, {})
    expect(node.style.visibility).toBe('hidden')
    template.layers.push(layer)
    paper.update(template, { 姓名: '甲' })
    expect(node.getAttribute('style')).toBe(original)
    expect(paper.root.querySelector('[data-print-node]')).toBe(node)
  })
  it('新增图层的图片保持 contain，重排和删除同步 DOM，纸张可改尺寸', () => {
    const template = createCardTemplate('blank')
    const first = createCardLayer(CardLayerKindEnum.Image)
    first.image = 'data:image/png;base64,AAAA'
    const second = createCardLayer(CardLayerKindEnum.Text, '正文')
    template.layers = [first, second]
    const paper = createCardPaperDom(template, {})
    expect(paper.root.querySelector<HTMLImageElement>('[data-print-extra]')!.style.objectFit).toBe(
      'contain'
    )
    template.layers.reverse()
    template.width = 148
    paper.update(template, {})
    expect(
      Array.from(paper.root.querySelectorAll<HTMLElement>('[data-print-extra]')).map(
        (node) => node.dataset.printExtra
      )
    ).toEqual([second.id, first.id])
    expect(paper.root.style.width).toBe('888px')
    template.layers = [second]
    paper.update(template, {})
    expect(paper.root.querySelectorAll('[data-print-extra]')).toHaveLength(1)
  })
})
