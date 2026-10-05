import { describe, expect, it } from 'vitest'

import { createCardTemplate } from '../../src/utils/cardTemplateUtil'
import {
  getCardDefaultFields,
  getCardTemplateFields
} from '../../src/utils/print-template/cardPresetUtil'
import { createCardPaperDom } from '../../src/utils/print-template/cardPaperDomUtil'

describe('成品模板公共字段与通知风格', () => {
  it('保存公共文案时不带入姓名、成绩或当前工作区日期', () => {
    const template = createCardTemplate('certificate')
    const globals = {
      标题: '学期奖状',
      称号: '进步之星',
      正文: '再接再厉',
      学校: '',
      落款: '班主任',
      姓名: '甲',
      成绩: '90',
      班级: '旧班级',
      学期: '上学期',
      日期: '旧日期'
    }
    expect(getCardDefaultFields(template, globals)).toEqual({
      标题: '学期奖状',
      称号: '进步之星',
      正文: '再接再厉',
      学校: '',
      落款: '班主任'
    })
    expect(getCardTemplateFields(template)).not.toContain('学期')
    template.layers[2].hidden = true
    expect(getCardTemplateFields(template)).not.toContain('称号')
  })
  it('纸框仍是 DOM，序列化后保留素材，移除装饰不会残留；旧模板兼容白底', () => {
    const template = JSON.parse(JSON.stringify(createCardTemplate('card')))
    const paper = createCardPaperDom(template, { 标题: '表扬卡', 姓名: '甲' })
    expect(paper.root.querySelector('[data-card-frame]')).not.toBeNull()
    expect(paper.root.querySelector('[data-card-frame]')!.querySelectorAll('img')).toHaveLength(8)
    expect(paper.root.textContent).toContain('甲 同学：')
    template.frame = undefined
    paper.update(template, { 标题: '表扬卡', 姓名: '乙' })
    expect(paper.root.querySelector('[data-card-frame]')).toBeNull()
    expect(paper.root.textContent).toContain('乙 同学')
    template.background = ''
    paper.update(template, {})
    expect(paper.root.querySelector('img')).toBeNull()
  })
  it('落款跳过空学校和署名，用中文日期展示，更新后不残留旧落款', () => {
    const template = createCardTemplate('certificate')
    const fields = { 学校: '', 班级: '403班', 落款: '', 日期: '2026-10-05' }
    const paper = createCardPaperDom(template, fields)
    const signature = paper.root.querySelector<HTMLElement>(
      `[data-print-extra="${template.layers[4].id}"]`
    )!
    expect(signature.textContent).toBe('403班\n2026年10月5日')
    expect(signature.style.textAlign).toBe('right')
    expect(fields.日期).toBe('2026-10-05')
    paper.update(template, { ...fields, 学校: '实验小学', 落款: '班主任', 日期: '待定' })
    expect(signature.textContent).toBe('实验小学\n403班　班主任\n待定')
    paper.update(template, { 学校: '', 班级: '', 落款: '', 日期: '' })
    expect(signature.textContent).toBe('')
  })
})
