import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DutyPositionContextMenu from '@/views/duty-roster/components/DutyPositionContextMenu.vue'

/**
 * DutyPositionContextMenu 组件测试
 * 测试目标：岗位右键菜单
 * 覆盖功能：菜单定位样式、新增/删除菜单项渲染、add/remove 事件
 * 以及 canRemove 为 false 时删除项禁用
 */

const mountMenu = (props: Partial<{ x: number; y: number; canRemove: boolean }> = {}) =>
  mount(DutyPositionContextMenu, {
    props: { x: 120, y: 240, canRemove: true, ...props }
  })

describe('DutyPositionContextMenu', () => {
  it('positions the menu with the given coordinates', () => {
    const wrapper = mountMenu({ x: 66, y: 88 })

    expect(wrapper.get('.duty-context-menu').attributes('style')).toContain('left: 66px')
    expect(wrapper.get('.duty-context-menu').attributes('style')).toContain('top: 88px')
  })

  it('renders the add and remove entries', () => {
    const wrapper = mountMenu()

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toContain('新增一列')
    expect(buttons[1].text()).toContain('删除当前列')
  })

  it('emits add when the add entry is clicked', async () => {
    const wrapper = mountMenu()

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('add')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('emits remove when the remove entry is clicked and removal is allowed', async () => {
    const wrapper = mountMenu({ canRemove: true })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('disables the remove entry when removal is not allowed', () => {
    const wrapper = mountMenu({ canRemove: false })

    const removeButton = wrapper.findAll('button')[1]
    expect(removeButton.attributes('disabled')).toBeDefined()
    expect(removeButton.classes()).toContain('is-danger')
  })
})
