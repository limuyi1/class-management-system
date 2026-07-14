import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const push = vi.fn()
const resolve = vi.fn((path: string) => ({ href: `#${path}` }))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
    resolve
  })
}))

import ToolsPage from '../../../src/views/tools/ToolsPage.vue'

describe('ToolsPage', () => {
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
