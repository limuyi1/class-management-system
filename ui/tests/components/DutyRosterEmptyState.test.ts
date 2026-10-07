import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { DutyRosterModeEnum } from '@/types/DutyRoster'
import DutyRosterEmptyState from '@/views/duty-roster/components/DutyRosterEmptyState.vue'

/**
 * DutyRosterEmptyState 组件测试
 * 测试目标：值日表空状态
 * 覆盖功能：标题与模式卡片渲染、模式高亮、updateMode 事件携带模式参数、
 * 创建按钮文案随名单来源变化与 create 事件
 */

const globalStubs = {
  ElButton: { template: '<button type="button"><slot /></button>' }
}

const mountEmptyState = (props: Partial<{ mode: DutyRosterModeEnum; source: 'system' | 'excel'; hasExcelSource: boolean }> = {}) =>
  mount(DutyRosterEmptyState, {
    props: {
      mode: DutyRosterModeEnum.Daily,
      source: 'system',
      hasExcelSource: false,
      ...props
    },
    global: { stubs: globalStubs }
  })

describe('DutyRosterEmptyState', () => {
  it('renders the guidance copy and both mode cards', () => {
    const wrapper = mountEmptyState()

    expect(wrapper.text()).toContain('创建一张班级值日表')
    expect(wrapper.text()).toContain('选择安排方式后，从学生名单拖入对应清洁岗位。')
    const modes = wrapper.findAll('.duty-empty__modes button')
    expect(modes).toHaveLength(2)
    expect(modes[0].text()).toContain('每组一天')
    expect(modes[1].text()).toContain('每组一周')
  })

  it('marks the current mode card as active', () => {
    const daily = mountEmptyState({ mode: DutyRosterModeEnum.Daily })
    const weekly = mountEmptyState({ mode: DutyRosterModeEnum.Weekly })

    expect(daily.findAll('.duty-empty__modes button')[0].classes()).toContain('is-active')
    expect(daily.findAll('.duty-empty__modes button')[1].classes()).not.toContain('is-active')
    expect(weekly.findAll('.duty-empty__modes button')[1].classes()).toContain('is-active')
    expect(weekly.findAll('.duty-empty__modes button')[0].classes()).not.toContain('is-active')
  })

  it('emits updateMode with the clicked mode', async () => {
    const wrapper = mountEmptyState()
    const modes = wrapper.findAll('.duty-empty__modes button')

    await modes[1].trigger('click')
    await modes[0].trigger('click')

    expect(wrapper.emitted('updateMode')).toEqual([
      [DutyRosterModeEnum.Weekly],
      [DutyRosterModeEnum.Daily]
    ])
  })

  it('emits create when the system source create button is clicked', async () => {
    const wrapper = mountEmptyState({ source: 'system' })
    const button = wrapper.findAll('button').find((item) => item.text().includes('创建值日表'))

    expect(button?.text()).toContain('创建值日表')
    await button?.trigger('click')

    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('prompts for import first when the excel source has no file yet', async () => {
    const wrapper = mountEmptyState({ source: 'excel', hasExcelSource: false })
    const button = wrapper.findAll('button').find((item) => item.text().includes('导入名单'))

    expect(button?.text()).toContain('导入名单并创建')
    await button?.trigger('click')

    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('creates directly when the excel source is already uploaded', async () => {
    const wrapper = mountEmptyState({ source: 'excel', hasExcelSource: true })

    const buttons = wrapper.findAll('button').map((item) => item.text())
    expect(buttons.some((text) => text.includes('导入名单'))).toBe(false)
    expect(buttons.some((text) => text.includes('创建值日表'))).toBe(true)
  })
})
