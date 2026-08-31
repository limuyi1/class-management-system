import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { DutyPeriodEnum, DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import DutyScheduleMatrix from '@/views/duty-roster/components/DutyScheduleMatrix.vue'

/**
 * DutyScheduleMatrix 组件测试
 * 测试目标：值日安排矩阵（编辑态表格）
 * 覆盖功能：五个工作日的渲染、周次模式的编辑行、岗位名称双击重命名与右键菜单入口
 */

// 按模式构造值日数据：每日模式含一个周行，每周模式追加第二个周行
function createRoster(mode: DutyRosterModeEnum = DutyRosterModeEnum.Daily): DutyRosterType {
  const weeklyRows = [
    { id: 'weekly-row-1', sortOrder: 0 },
    ...(mode === DutyRosterModeEnum.Weekly ? [{ id: 'weekly-row-2', sortOrder: 1 }] : [])
  ]
  return {
    id: 'roster-1',
    name: '班级值日安排',
    mode,
    studentSource: 'system',
    sections: [
      {
        id: 'section-1',
        name: '室内岗位',
        kind: 'indoor',
        sortOrder: 0,
        positions: [
          { id: 'position-1', name: '一组+讲台', sortOrder: 0 },
          { id: 'position-2', name: '垃圾桶', sortOrder: 1 }
        ]
      }
    ],
    weeklyRows,
    assignments: [
      {
        period: mode === DutyRosterModeEnum.Daily ? DutyPeriodEnum.Monday : DutyPeriodEnum.Weekly,
        rowId: mode === DutyRosterModeEnum.Weekly ? 'weekly-row-1' : undefined,
        positionId: 'position-1',
        studentIds: ['student-1', 'student-2']
      }
    ],
    leaders: [
      {
        period: mode === DutyRosterModeEnum.Daily ? DutyPeriodEnum.Monday : DutyPeriodEnum.Weekly,
        rowId: mode === DutyRosterModeEnum.Weekly ? 'weekly-row-1' : undefined,
        sectionId: 'section-1',
        studentId: 'student-1'
      }
    ],
    notes: '',
    createdAt: '',
    updatedAt: ''
  }
}

// 验证矩阵的静态渲染与编辑交互事件
describe('DutyScheduleMatrix', () => {
  it('renders all five weekdays, flexible student counts and a neutral leader marker', () => {
    const wrapper = mount(DutyScheduleMatrix, {
      props: {
        roster: createRoster(),
        studentNames: { 'student-1': '张三', 'student-2': '李四' }
      }
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.text()).toContain('星期一')
    expect(wrapper.text()).toContain('星期五')
    expect(wrapper.findAll('.duty-matrix__student')).toHaveLength(2)
    expect(wrapper.find('.duty-matrix__leader-dot').exists()).toBe(true)
    expect(wrapper.find('.duty-matrix__leader-dot').text()).toBe('组')
    expect(wrapper.find('.duty-matrix__student.is-leader').attributes('aria-label')).toBe(
      '张三，组长'
    )
    expect(wrapper.find('.duty-matrix__student.is-leader').attributes('title')).toContain(
      '张三（组长）'
    )
    expect(wrapper.find('.duty-matrix__crown').exists()).toBe(false)
  })

  it('renders editable weekly rows without showing week labels', async () => {
    const wrapper = mount(DutyScheduleMatrix, {
      props: { roster: createRoster(DutyRosterModeEnum.Weekly), studentNames: {} }
    })

    expect(wrapper.findAll('.duty-matrix__data-row')).toHaveLength(2)
    expect(wrapper.find('.duty-matrix__period-head').exists()).toBe(false)
    expect(wrapper.find('.duty-matrix__row-action-head').exists()).toBe(true)
    expect(
      wrapper.findAll('.duty-matrix__data-row')[0].element.lastElementChild?.classList
    ).toContain('duty-matrix__row-action-cell')
    expect(wrapper.text()).not.toContain('本周')
    expect(wrapper.text()).not.toContain('周次')

    await wrapper.get('.duty-matrix__add-row button').trigger('click')
    expect(wrapper.emitted('addWeeklyRow')?.[0]).toEqual([])

    await wrapper.findAll('.duty-matrix__remove-row')[0].trigger('click')
    expect(wrapper.emitted('removeWeeklyRow')?.[0]).toEqual(['weekly-row-1'])
  })

  it('edits a position name on double click and exposes the two-item context entry point', async () => {
    const wrapper = mount(DutyScheduleMatrix, {
      props: { roster: createRoster(), studentNames: {} }
    })
    const header = wrapper.findAll('.duty-matrix__position-head')[0]

    await header.trigger('dblclick')
    const input = wrapper.get('.duty-matrix__position-input')
    await input.setValue('讲台和值日角')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('renamePosition')?.[0]).toEqual(['position-1', '讲台和值日角'])

    await header.trigger('contextmenu', { clientX: 80, clientY: 120 })
    expect(wrapper.emitted('positionContext')?.[0]?.[0]).toBe('position-1')

    await header.get('.duty-matrix__position-action').trigger('click')
    expect(wrapper.emitted('positionContext')?.[1]?.[0]).toBe('position-1')
  })

  it('shows and clears the student drop target feedback', async () => {
    const wrapper = mount(DutyScheduleMatrix, {
      props: { roster: createRoster(), studentNames: {} }
    })
    const targetCell = wrapper.findAll('.duty-matrix__cell')[1]

    await targetCell.trigger('dragenter', { dataTransfer: { types: [] } })
    expect(targetCell.classes()).toContain('is-drop-target')

    await targetCell.trigger('drop')
    expect(targetCell.classes()).not.toContain('is-drop-target')
    expect(wrapper.emitted('dropStudent')?.[0]).toEqual([
      {
        period: DutyPeriodEnum.Monday,
        rowId: undefined,
        positionId: 'position-2'
      }
    ])
  })
})
