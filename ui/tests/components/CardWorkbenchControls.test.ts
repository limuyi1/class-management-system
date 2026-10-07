import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it } from 'vitest'

import CardContentPanel from '../../src/views/tools/components/cards/CardContentPanel.vue'
import CardCanvas from '../../src/views/tools/components/cards/CardCanvas.vue'
import { createCardTemplate } from '../../src/utils/cardTemplateUtil'

/** 基础制作与高级编辑的边界，防止填写内容又被带回图层编辑。 */
describe('卡片制作交互', () => {
  it('只显示模板实际使用的公共字段，正文直接更新；姓名、未使用学期不出现', async () => {
    const template = createCardTemplate('certificate')
    const globals = {
      标题: '奖状',
      称号: '学习之星',
      正文: '原文',
      班级: '一班',
      学期: '上学期',
      学校: '',
      落款: '',
      日期: '2026-10-04'
    }
    const wrapper = mount(CardContentPanel, {
      props: { template, globals, busy: false, studentFields: ['姓名', '称号'] },
      global: { plugins: [ElementPlus] }
    })
    const labels = wrapper.findAll('.el-form-item__label').map((item) => item.text())
    expect(labels).toContain('表扬正文')
    expect(labels).not.toContain('学期')
    expect(labels).not.toContain('姓名')
    await wrapper.get('textarea').setValue('新的表扬正文')
    expect(globals.正文).toBe('新的表扬正文')
    await flushPromises()
    wrapper.unmount()
  })
  it('署名日期默认收起，展开修改后折叠不会丢失填写内容', async () => {
    const globals = { 标题: '奖状', 正文: '原文', 落款: '班主任', 日期: '2026-10-04' }
    const wrapper = mount(CardContentPanel, {
      props: {
        template: createCardTemplate('certificate'),
        globals,
        busy: false,
        studentFields: []
      },
      global: { plugins: [ElementPlus] }
    })
    const header = wrapper.get('.el-collapse-item__header')
    expect(header.attributes('aria-expanded')).toBe('false')
    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('true')
    const signature = wrapper
      .findAll('.el-form-item')
      .find((item) => item.text() === '落款（选填）')!
    await signature.get('input').setValue('三年级班主任')
    await header.trigger('click')
    await header.trigger('click')
    expect(signature.get('input').element.value).toBe('三年级班主任')
    expect(globals.落款).toBe('三年级班主任')
    await flushPromises()
    wrapper.unmount()
  })
  it('只有学生名单提供的变量不要求教师重复填写', async () => {
    const template = createCardTemplate('blank')
    const layer = createCardTemplate('certificate').layers[0]
    layer.text = '{{姓名}} {{奖励项目}}'
    template.layers = [layer]
    const wrapper = mount(CardContentPanel, {
      props: { template, globals: {}, busy: false, studentFields: ['姓名', '奖励项目'] },
      global: { plugins: [ElementPlus] }
    })
    expect(wrapper.findAll('.el-form-item')).toHaveLength(0)
    await flushPromises()
    wrapper.unmount()
  })
  it('普通制作没有拖动控件、点击文字不切换图层；高级模式才可选层', async () => {
    const template = createCardTemplate('certificate')
    const layer = template.layers[0]
    const wrapper = mount(CardCanvas, {
      props: { template, fields: {}, busy: false, modelValue: layer.id, editing: false },
      global: {
        stubs: { CardPaper: { template: `<div data-print-extra="${layer.id}">标题</div>` } }
      }
    })
    expect(wrapper.find('.card-canvas__selection').exists()).toBe(false)
    await wrapper.get('[data-print-extra]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    await wrapper.setProps({ editing: true })
    expect(wrapper.find('.card-canvas__selection').exists()).toBe(true)
    await wrapper.get('[data-print-extra]').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    await flushPromises()
    wrapper.unmount()
  })
})
