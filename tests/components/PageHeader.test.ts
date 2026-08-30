import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import PageHeader from '../../src/components/PageHeader.vue'

/**
 * PageHeader 组件测试
 * 测试目标：页面头部通用组件
 * 覆盖功能：图标/标题/副标题渲染、右侧插槽（单个与多个元素）、空插槽、超长文本
 */
describe('PageHeader', () => {
  // 各用例复用的默认 props：图标、标题与副标题
  const defaultProps = {
    icon: ['fas', 'user'] as string[],
    title: 'Test Title',
    subtitle: 'Test Subtitle'
  }

  it('should render with all props', () => {
    const wrapper = mount(PageHeader, {
      props: defaultProps
    })

    expect(wrapper.find('.page-header').exists()).toBe(true)
    expect(wrapper.find('.header-text h2').text()).toBe('Test Title')
    expect(wrapper.find('.header-text p').text()).toBe('Test Subtitle')
    expect(wrapper.find('.header-icon').exists()).toBe(true)
  })

  it('should render slot content in header-right', () => {
    const wrapper = mount(PageHeader, {
      props: defaultProps,
      slots: {
        right: h('button', { class: 'test-button' }, 'Test Button')
      }
    })

    expect(wrapper.find('.header-right .test-button').exists()).toBe(true)
    expect(wrapper.find('.header-right .test-button').text()).toBe('Test Button')
  })

  it('should have correct CSS classes', () => {
    const wrapper = mount(PageHeader, {
      props: defaultProps
    })

    expect(wrapper.find('.page-header').exists()).toBe(true)
    expect(wrapper.find('.header-left').exists()).toBe(true)
    expect(wrapper.find('.header-right').exists()).toBe(true)
    expect(wrapper.find('.header-icon').exists()).toBe(true)
    expect(wrapper.find('.header-text').exists()).toBe(true)
  })

  it('should render multiple elements in right slot', () => {
    const wrapper = mount(PageHeader, {
      props: defaultProps,
      slots: {
        right: [
          h('button', { class: 'btn-1' }, 'Button 1'),
          h('button', { class: 'btn-2' }, 'Button 2')
        ]
      }
    })

    expect(wrapper.find('.header-right .btn-1').exists()).toBe(true)
    expect(wrapper.find('.header-right .btn-2').exists()).toBe(true)
  })

  it('should render empty right slot area when no slot content', () => {
    const wrapper = mount(PageHeader, {
      props: defaultProps
    })

    expect(wrapper.find('.header-right').exists()).toBe(true)
    expect(wrapper.find('.header-right').html()).not.toContain('test-button')
  })

  it('should display icon container', () => {
    const wrapper = mount(PageHeader, {
      props: defaultProps
    })

    expect(wrapper.find('.header-icon').exists()).toBe(true)
    expect(wrapper.find('.header-icon').html()).toContain('font-awesome-icon')
  })

  it('should handle long title text', () => {
    const longTitle = 'A'.repeat(100)
    const wrapper = mount(PageHeader, {
      props: { ...defaultProps, title: longTitle }
    })

    expect(wrapper.find('.header-text h2').text()).toBe(longTitle)
  })

  it('should handle long subtitle text', () => {
    const longSubtitle = 'B'.repeat(100)
    const wrapper = mount(PageHeader, {
      props: { ...defaultProps, subtitle: longSubtitle }
    })

    expect(wrapper.find('.header-text p').text()).toBe(longSubtitle)
  })
})
