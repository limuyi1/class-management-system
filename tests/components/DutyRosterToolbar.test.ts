import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { DutyRosterModeEnum } from '@/types/DutyRoster'
import DutyRosterToolbar from '@/views/duty-roster/components/DutyRosterToolbar.vue'

/**
 * DutyRosterToolbar 组件测试
 * 测试目标：值日表工具栏
 * 覆盖功能：名称渲染与双击重命名（回车/失焦提交、Esc 取消、名称未变化不触发）、
 * 模式切换事件、岗位设置/打印预览/全屏按钮的事件转发
 */

const globalStubs = {
  ElButton: { template: '<button type="button"><slot /></button>' },
  ElSegmented: {
    name: 'ElSegmented',
    template: '<div><slot /></div>'
  },
  ElTooltip: {
    name: 'ElTooltip',
    props: ['content'],
    template: '<span><slot /></span>'
  }
}

const mountToolbar = (props: Partial<{ rosterName: string; mode: DutyRosterModeEnum; fullscreen: boolean }> = {}) =>
  mount(DutyRosterToolbar, {
    props: {
      rosterName: '班级值日安排',
      mode: DutyRosterModeEnum.Daily,
      fullscreen: false,
      ...props
    },
    global: { stubs: globalStubs }
  })

describe('DutyRosterToolbar', () => {
  it('renders the roster name', () => {
    const wrapper = mountToolbar()

    expect(wrapper.get('.duty-toolbar__name').text()).toBe('班级值日安排')
  })

  it('commits a rename on Enter after double-click editing', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('.duty-toolbar__name').trigger('dblclick')
    const input = wrapper.get('.duty-toolbar__name-input')
    expect((input.element as HTMLInputElement).value).toBe('班级值日安排')

    await input.setValue(' 新学期值日表 ')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('rename')?.[0]).toEqual(['新学期值日表'])
    expect(wrapper.find('.duty-toolbar__name-input').exists()).toBe(false)
    expect(wrapper.get('.duty-toolbar__name').text()).toBe('班级值日安排')
  })

  it('commits a rename on blur', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('.duty-toolbar__name').trigger('dblclick')
    await wrapper.get('.duty-toolbar__name-input').setValue('值日表二期')
    await wrapper.get('.duty-toolbar__name-input').trigger('blur')

    expect(wrapper.emitted('rename')?.[0]).toEqual(['值日表二期'])
    expect(wrapper.find('.duty-toolbar__name-input').exists()).toBe(false)
  })

  it('cancels editing on Escape without emitting rename', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('.duty-toolbar__name').trigger('dblclick')
    await wrapper.get('.duty-toolbar__name-input').setValue('不该提交的名字')
    await wrapper.get('.duty-toolbar__name-input').trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(wrapper.find('.duty-toolbar__name-input').exists()).toBe(false)
  })

  it('does not emit rename when the name is unchanged', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('.duty-toolbar__name').trigger('dblclick')
    await wrapper.get('.duty-toolbar__name-input').trigger('blur')

    expect(wrapper.emitted('rename')).toBeUndefined()
  })

  it('forwards valid segmented mode changes', async () => {
    const wrapper = mountToolbar()
    const segmented = wrapper.findComponent({ name: 'ElSegmented' })

    segmented.vm.$emit('change', DutyRosterModeEnum.Weekly)
    segmented.vm.$emit('change', DutyRosterModeEnum.Daily)

    expect(wrapper.emitted('changeMode')).toEqual([
      [DutyRosterModeEnum.Weekly],
      [DutyRosterModeEnum.Daily]
    ])
  })

  it('ignores invalid segmented values', () => {
    const wrapper = mountToolbar()

    wrapper.findComponent({ name: 'ElSegmented' }).vm.$emit('change', 'invalid')
    wrapper.findComponent({ name: 'ElSegmented' }).vm.$emit('change', undefined)

    expect(wrapper.emitted('changeMode')).toBeUndefined()
  })

  it('forwards manage sections, export and fullscreen button clicks', async () => {
    const wrapper = mountToolbar()
    const buttons = wrapper.findAll('button')

    // 按钮顺序：名称、岗位设置、打印预览、全屏
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    await buttons[3].trigger('click')

    expect(wrapper.emitted('manageSections')).toHaveLength(1)
    expect(wrapper.emitted('export')).toHaveLength(1)
    expect(wrapper.emitted('toggleFullscreen')).toHaveLength(1)
  })

  it('shows the fullscreen tooltip according to the fullscreen prop', () => {
    const normal = mountToolbar()
    const fullscreen = mountToolbar({ fullscreen: true })

    expect(normal.findComponent({ name: 'ElTooltip' }).props('content')).toBe('全屏')
    expect(fullscreen.findComponent({ name: 'ElTooltip' }).props('content')).toBe('退出全屏')
  })
})
