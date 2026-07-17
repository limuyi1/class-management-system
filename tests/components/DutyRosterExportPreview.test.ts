import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import { PagesEnum } from '@/types/Common'
import { DutyPeriodEnum, DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import DutyRosterExportPreview from '@/views/duty-roster/components/DutyRosterExportPreview.vue'

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

function createRoster(): DutyRosterType {
  return {
    id: 'roster-1',
    name: '303班清洁值日表',
    mode: DutyRosterModeEnum.Daily,
    studentSource: 'system',
    sections: [
      {
        id: 'section-1',
        name: '室内岗位',
        kind: 'indoor',
        sortOrder: 0,
        positions: [{ id: 'position-1', name: '讲台', sortOrder: 0 }]
      }
    ],
    weeklyRows: [{ id: 'weekly-row-1', sortOrder: 0 }],
    assignments: [
      {
        period: DutyPeriodEnum.Monday,
        positionId: 'position-1',
        studentIds: ['student-1']
      }
    ],
    leaders: [
      {
        period: DutyPeriodEnum.Monday,
        sectionId: 'section-1',
        studentId: 'student-1'
      }
    ],
    notes: '红色圆点及红色姓名表示值日组长\n组长负责检查卫生',
    createdAt: '',
    updatedAt: ''
  }
}

describe('DutyRosterExportPreview', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', ResizeObserverMock))
  afterEach(() => vi.unstubAllGlobals())

  it('renders an A4 landscape sheet without editor controls or period ranges', () => {
    const wrapper = mount(DutyRosterExportPreview, {
      props: {
        roster: createRoster(),
        studentNames: { 'student-1': '张三' },
        pageType: PagesEnum.A4
      }
    })

    expect(wrapper.get('.duty-print-sheet').attributes('style')).toContain('width: 841.89px')
    expect(wrapper.get('.duty-sheet-header h2').text()).toBe('303班清洁值日表')
    expect(wrapper.find('.duty-content-viewport').exists()).toBe(true)
    expect(wrapper.text()).toContain('303班清洁值日表')
    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).toContain('组长负责检查卫生')
    expect(wrapper.text()).not.toContain('周次')
    expect(wrapper.text()).not.toContain('日期范围')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('拖入学生')
  })

  it('renders every weekly row without editor anchors', () => {
    const roster = createRoster()
    roster.mode = DutyRosterModeEnum.Weekly
    roster.weeklyRows = [
      { id: 'weekly-row-1', sortOrder: 0 },
      { id: 'weekly-row-2', sortOrder: 1 }
    ]
    roster.assignments = [
      {
        period: DutyPeriodEnum.Weekly,
        rowId: 'weekly-row-2',
        positionId: 'position-1',
        studentIds: ['student-1']
      }
    ]
    roster.leaders = []

    const wrapper = mount(DutyRosterExportPreview, {
      props: { roster, studentNames: { 'student-1': '张三' } }
    })

    expect(wrapper.findAll('.duty-print-table tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).not.toContain('新增一行')
    expect(wrapper.find('.duty-matrix__row-action-head').exists()).toBe(false)
  })

  it('scales the natural content without changing the paper size', async () => {
    const wrapper = mount(DutyRosterExportPreview, {
      props: {
        roster: createRoster(),
        studentNames: {},
        layoutScalePercent: 100
      }
    })
    const originalPaperStyle = wrapper.get('.duty-print-sheet').attributes('style')
    const originalContentStyle = wrapper.get('.duty-export-content').attributes('style')

    await wrapper.setProps({ layoutScalePercent: 90 })

    expect(wrapper.get('.duty-print-sheet').attributes('style')).toBe(originalPaperStyle)
    expect(wrapper.get('.duty-export-content').attributes('style')).not.toBe(originalContentStyle)
  })

  it('hides the title and notes together with their paper decorations', () => {
    const wrapper = mount(DutyRosterExportPreview, {
      props: {
        roster: createRoster(),
        studentNames: {},
        showTitle: false,
        showNotes: false
      }
    })

    expect(wrapper.find('.duty-sheet-header').exists()).toBe(false)
    expect(wrapper.find('.duty-print-notes').exists()).toBe(false)
    expect(wrapper.find('.duty-print-table').exists()).toBe(true)
  })
})
