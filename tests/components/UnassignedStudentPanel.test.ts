import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ElInput } from 'element-plus'

import UnassignedStudentPanel from '../../src/views/seating-chart/components/UnassignedStudentPanel.vue'

const global = {
  components: {
    ElInput
  },
  stubs: {
    FontAwesomeIcon: true
  }
}

describe('UnassignedStudentPanel', () => {
  it('renders compact student cards and emits selection events', async () => {
    const wrapper = mount(UnassignedStudentPanel, {
      props: {
        students: [
          { id: '1', name: '张三' },
          { id: '2', name: '李四' }
        ],
        totalStudentCount: 2,
        selectedStudentId: '2'
      },
      global
    })

    expect(wrapper.findAll('.student-card')).toHaveLength(2)
    expect(wrapper.get('.unassigned-panel__count').text()).toContain('2 人')
    expect(wrapper.findAll('.student-card')[1].classes()).toContain('is-selected')

    await wrapper.findAll('.student-card')[0].trigger('click')
    expect(wrapper.emitted('selectStudent')).toEqual([['1']])
  })

  it('shows the completed state when every student is assigned', () => {
    const wrapper = mount(UnassignedStudentPanel, {
      props: {
        students: [],
        totalStudentCount: 12,
        selectedStudentId: null
      },
      global
    })

    expect(wrapper.get('.unassigned-empty').classes()).toContain('is-complete')
    expect(wrapper.text()).toContain('全部安排完成')
    expect(wrapper.find('.unassigned-panel__search').exists()).toBe(false)
  })

  it('shows the no-roster state when no students are available', () => {
    const wrapper = mount(UnassignedStudentPanel, {
      props: {
        students: [],
        totalStudentCount: 0,
        selectedStudentId: null
      },
      global
    })

    expect(wrapper.get('.unassigned-empty').classes()).toContain('is-no-students')
    expect(wrapper.text()).toContain('暂无可安排学生')
  })

  it('shows a searchable empty state and clears the query', async () => {
    const wrapper = mount(UnassignedStudentPanel, {
      props: {
        students: [{ id: '1', name: '张三' }],
        totalStudentCount: 1,
        selectedStudentId: null
      },
      global
    })

    await wrapper.get('input').setValue('李四')
    expect(wrapper.text()).toContain('没有找到“李四”')

    await wrapper.get('.unassigned-empty button').trigger('click')
    expect(wrapper.findAll('.student-card')).toHaveLength(1)
  })
})
