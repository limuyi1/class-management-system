import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DutyStudentContextMenu from '@/views/duty-roster/components/DutyStudentContextMenu.vue'

const global = { stubs: { FontAwesomeIcon: true } }

describe('DutyStudentContextMenu', () => {
  it('offers copy and delete only for pending cards', async () => {
    const wrapper = mount(DutyStudentContextMenu, {
      props: { x: 10, y: 20, location: 'pending', canDelete: false },
      global
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.map((button) => button.text())).toEqual(['复制', '删除'])
    expect(buttons[1].attributes('disabled')).toBeDefined()

    await buttons[0].trigger('click')
    expect(wrapper.emitted('copy')).toHaveLength(1)
  })

  it('keeps leader settings and remove for assigned cards', async () => {
    const wrapper = mount(DutyStudentContextMenu, {
      props: { x: 10, y: 20, location: 'assigned', isLeader: true },
      global
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.map((button) => button.text())).toEqual(['复制', '取消组长', '移除'])

    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    expect(wrapper.emitted('toggleLeader')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})
