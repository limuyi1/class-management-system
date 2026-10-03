/** 验证值日单元格拆分后仍向矩阵传递完整分配目标和鼠标坐标。 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DutyAssignmentCell from '../../src/views/duty-roster/components/DutyAssignmentCell.vue'
import { DutyPeriodEnum } from '../../src/types/DutyRoster'

const target = { period: DutyPeriodEnum.Monday, positionId: 'p1' }

describe('值日分配单元格', () => {
  it('保留组长展示并转发拖拽和右键菜单', async () => {
    const wrapper = mount(DutyAssignmentCell, {
      props: {
        target,
        studentIds: ['s1'],
        studentNames: { s1: '张三' },
        leaderIds: ['s1'],
        cleaning: false,
        dropTarget: false
      }
    })
    const card = wrapper.get('.duty-matrix__student')
    expect(card.classes()).toContain('is-leader')
    await card.trigger('dragstart')
    expect(wrapper.emitted('dragStudentStart')?.[0]).toEqual(['s1', target])
    await card.trigger('contextmenu', { clientX: 20, clientY: 30 })
    const [event, studentId, destination] = wrapper.emitted('studentContext')![0]
    expect(event).toMatchObject({ clientX: 20, clientY: 30 })
    expect(studentId).toBe('s1')
    expect(destination).toEqual(target)
    wrapper.unmount()
  })

  it('空岗位保留提示并提交完整投放目标', async () => {
    const wrapper = mount(DutyAssignmentCell, {
      props: {
        target,
        studentIds: [],
        studentNames: {},
        leaderIds: [],
        cleaning: true,
        dropTarget: true
      }
    })
    expect(wrapper.text()).toContain('拖入学生')
    expect(wrapper.classes()).toContain('is-drop-target')
    await wrapper.trigger('drop')
    expect(wrapper.emitted('dropStudent')?.[0]).toEqual([target])
    wrapper.unmount()
  })
})
