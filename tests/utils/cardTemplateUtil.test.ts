import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import {
  createCardPdf,
  createCardTemplate,
  resolveCardText,
  wrapCardText
} from '../../src/utils/cardTemplateUtil'

describe('通用卡片变量与排版', () => {
  it('变量只按字段替换，空值允许，缺失变量保留供校验', () => {
    expect(
      resolveCardText('{{ 姓名 }} / {{学校}} / {{未提供}}', { 姓名: '张同学', 学校: '' })
    ).toBe('张同学 /  / {{未提供}}')
    expect(resolveCardText('{{constructor}}', {})).toBe('{{constructor}}')
  })
  it('中文长文本和明确换行都完整保留', () => {
    const lines = wrapCardText('第一行很长\n\n第二行', 3, (text) => Array.from(text).length)
    expect(lines).toEqual(['第一行', '很长', '', '第二行'])
  })
  it('内置模板的每个图层都在页面边界内，副本身份独立', () => {
    for (const preset of ['certificate', 'card', 'blank'] as const) {
      const template = createCardTemplate(preset)
      for (const layer of template.layers) {
        expect(layer.x + layer.width).toBeLessThanOrEqual(template.width)
        expect(layer.y + layer.height).toBeLessThanOrEqual(template.height)
      }
      expect(createCardTemplate(preset).id).not.toBe(template.id)
    }
  })
  it('原尺寸 PDF 保持毫米尺寸，五人四联生成两页', async () => {
    const png = new Uint8Array(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=',
        'base64'
      )
    )
    const entries = Array.from({ length: 5 }, (_, index) => ({ name: `${index}.png`, data: png }))
    const template = createCardTemplate('card')
    const original = await PDFDocument.load(
      await (await createCardPdf(entries.slice(0, 1), template, false)).arrayBuffer()
    )
    expect(original.getPages()[0].getWidth()).toBeCloseTo((148 * 72) / 25.4)
    const composed = await PDFDocument.load(
      await (await createCardPdf(entries, template, true)).arrayBuffer()
    )
    expect(composed.getPageCount()).toBe(2)
  })
})
