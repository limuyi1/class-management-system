import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DutyNotesPanel from '@/views/duty-roster/components/DutyNotesPanel.vue'

/**
 * DutyNotesPanel 组件测试
 * 测试目标：备注说明面板
 * 覆盖功能：按行渲染备注、空行过滤、空态提示与编辑事件
 */

const globalStubs = {
  ElButton: { template: '<button type="button"><slot /></button>' }
}

const mountPanel = (notes: string) =>
  mount(DutyNotesPanel, { props: { notes }, global: { stubs: globalStubs } })

describe('DutyNotesPanel', () => {
  it('renders each non-empty note line', () => {
    const wrapper = mountPanel('红色姓名表示值日组长\n\n1. 组长负责分工并检查卫生；\n2. 摆课桌、窗台和门。')

    const lines = wrapper.findAll('.duty-notes__content p')
    expect(lines).toHaveLength(3)
    expect(lines[0].text()).toBe('红色姓名表示值日组长')
    expect(lines[1].text()).toBe('1. 组长负责分工并检查卫生；')
    expect(lines[2].text()).toBe('2. 摆课桌、窗台和门。')
  })

  it('shows the empty placeholder when notes are empty', () => {
    const wrapper = mountPanel('')

    expect(wrapper.get('.duty-notes__empty').text()).toBe('暂无备注说明')
  })

  it('filters whitespace-only lines into the empty placeholder', () => {
    const wrapper = mountPanel('  \n\t\n  ')

    expect(wrapper.get('.duty-notes__empty').exists()).toBe(true)
    expect(wrapper.findAll('.duty-notes__content p')).toHaveLength(1)
  })

  it('emits edit when the edit button is clicked', async () => {
    const wrapper = mountPanel('第一条说明')

    await wrapper.get('.duty-notes__heading button').trigger('click')

    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
