import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * ToolsPage 组件测试
 * 测试目标：工具中心页面
 * 覆盖功能：按教学场景分组展示工具卡片、点击卡片跳转到对应工具路由
 */

// 记录路由跳转与解析调用
const push = vi.fn()
const resolve = vi.fn((path: string) => ({ href: `#${path}` }))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
    resolve
  })
}))

import ToolsPage from '../../../src/views/tools/ToolsPage.vue'

// 验证工具分组展示与卡片点击跳转
describe('ToolsPage', () => {
  // 每个用例前清空路由 mock 的调用记录
  beforeEach(() => {
    push.mockClear()
    resolve.mockClear()
  })

  it('groups available tools by teaching scenario', () => {
    const wrapper = mount(ToolsPage)
    const sections = wrapper.findAll('.tool-section')

    expect(sections).toHaveLength(3)
    expect(sections[0].find('.tool-section__title').text()).toBe('教学反馈')
    expect(sections[0].findAll('.tool-card__title').map((item) => item.text())).toEqual([
      '评语处理',
      '成绩通知'
    ])
    expect(sections[1].find('.tool-section__title').text()).toBe('班级管理')
    expect(sections[1].findAll('.tool-card__title').map((item) => item.text())).toEqual([
      '座位表',
      '值日表',
      '名单核对'
    ])
    expect(sections[2].find('.tool-section__title').text()).toBe('文档与素材')
    expect(sections[2].findAll('.tool-card__title').map((item) => item.text())).toEqual([
      '试卷排版',
      '素材管理'
    ])
    expect(wrapper.text()).not.toContain('已上线')
  })

  it('opens a tool from its card', async () => {
    const wrapper = mount(ToolsPage)

    await wrapper.find('.tool-card').trigger('click')

    expect(push).toHaveBeenCalledWith('/tools/comments')
  })
})
