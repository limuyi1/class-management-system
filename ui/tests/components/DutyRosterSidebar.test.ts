import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import DutyRosterSidebar from '@/views/duty-roster/components/DutyRosterSidebar.vue'

/**
 * DutyRosterSidebar 组件测试
 * 测试目标：值日表方案侧边栏
 * 覆盖功能：方案列表渲染、当前方案高亮、折叠态、下拉菜单命令转发
 * 与 select/create/toggleCollapse 事件
 */

/** 构造一份最简值日表方案数据 */
function createRoster(id: string, name: string): DutyRosterType {
  return {
    id,
    name,
    mode: DutyRosterModeEnum.Daily,
    studentSource: 'system',
    sections: [],
    weeklyRows: [],
    assignments: [],
    leaders: [],
    notes: '',
    createdAt: '',
    updatedAt: ''
  }
}

const globalStubs = {
  ElButton: { template: '<button type="button"><slot /></button>' },
  // 同时渲染默认插槽与 dropdown 插槽，便于断言菜单内容与转发命令
  ElDropdown: {
    name: 'ElDropdown',
    template: '<div><slot /><slot name="dropdown" /></div>'
  },
  ElDropdownMenu: { template: '<div><slot /></div>' },
  ElDropdownItem: { template: '<div><slot /></div>' }
}

describe('DutyRosterSidebar', () => {
  it('renders the roster list and highlights the editing roster', () => {
    const wrapper = mount(DutyRosterSidebar, {
      props: {
        rosters: [createRoster('roster-1', '周一值日'), createRoster('roster-2', '整周值日')],
        editingRosterId: 'roster-2',
        collapsed: false
      },
      global: { stubs: globalStubs }
    })

    expect(wrapper.get('.duty-sidebar__heading strong').text()).toBe('值日表方案')
    const items = wrapper.findAll('.duty-sidebar__item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('周一值日')
    expect(items[1].text()).toContain('整周值日')
    expect(items[0].classes()).not.toContain('is-active')
    expect(items[1].classes()).toContain('is-active')
  })

  it('emits select with the roster id when a roster is clicked', async () => {
    const wrapper = mount(DutyRosterSidebar, {
      props: {
        rosters: [createRoster('roster-1', '周一值日')],
        editingRosterId: null,
        collapsed: false
      },
      global: { stubs: globalStubs }
    })

    await wrapper.get('.duty-sidebar__item').trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual(['roster-1'])
  })

  it('forwards dropdown copy/rename/remove commands with the roster id', () => {
    const wrapper = mount(DutyRosterSidebar, {
      props: {
        rosters: [createRoster('roster-1', '周一值日'), createRoster('roster-2', '整周值日')],
        editingRosterId: 'roster-1',
        collapsed: false
      },
      global: { stubs: globalStubs }
    })

    const dropdowns = wrapper.findAllComponents({ name: 'ElDropdown' })
    expect(dropdowns).toHaveLength(2)
    // 第一个下拉菜单对应第一个方案，命令需要携带该方案的 ID
    dropdowns[0].vm.$emit('command', 'copy')
    dropdowns[0].vm.$emit('command', 'rename')
    dropdowns[0].vm.$emit('command', 'remove')

    expect(wrapper.emitted('copy')).toEqual([['roster-1']])
    expect(wrapper.emitted('rename')).toEqual([['roster-1']])
    expect(wrapper.emitted('remove')).toEqual([['roster-1']])
  })

  it('emits create when the create button is clicked', async () => {
    const wrapper = mount(DutyRosterSidebar, {
      props: { rosters: [], editingRosterId: null, collapsed: false },
      global: { stubs: globalStubs }
    })

    await wrapper.get('.duty-sidebar__create').trigger('click')

    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('emits toggleCollapse when the heading toggle button is clicked', async () => {
    const wrapper = mount(DutyRosterSidebar, {
      props: { rosters: [], editingRosterId: null, collapsed: false },
      global: { stubs: globalStubs }
    })

    await wrapper.get('.duty-sidebar__heading button').trigger('click')

    expect(wrapper.emitted('toggleCollapse')).toHaveLength(1)
  })

  it('hides names and dropdown menus in the collapsed state', () => {
    const wrapper = mount(DutyRosterSidebar, {
      props: {
        rosters: [createRoster('roster-1', '周一值日')],
        editingRosterId: 'roster-1',
        collapsed: true
      },
      global: { stubs: globalStubs }
    })

    expect(wrapper.get('.duty-sidebar').classes()).toContain('is-collapsed')
    expect(wrapper.find('.duty-sidebar__heading strong').exists()).toBe(false)
    expect(wrapper.find('.duty-sidebar__item-name').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ElDropdown' }).exists()).toBe(false)
    expect(wrapper.get('.duty-sidebar__create').text()).not.toContain('新建值日表')
  })
})
