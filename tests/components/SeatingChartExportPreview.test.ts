import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import SeatingChartExportPreview from '@/views/seating-chart/components/SeatingChartExportPreview.vue'
import {
  SeatingSpecialSeatPositionEnum,
  SeatingViewDirectionEnum,
  type SeatingChartType
} from '@/types/SeatingChart'
import { createSeats, createSpecialSeats } from '@/utils/seatingChartUntil'

function createChart(): SeatingChartType {
  const seats = createSeats(2, 2)
  seats[0].studentId = 'student-1'
  const specialSeats = createSpecialSeats()
  const leftSeat = specialSeats.find(
    (seat) => seat.position === SeatingSpecialSeatPositionEnum.PlatformLeft
  )!
  leftSeat.enabled = true
  leftSeat.studentId = 'student-2'

  return {
    id: 'chart-1',
    name: '一班座位表',
    rows: 2,
    columns: 2,
    aisleAfterColumns: [0],
    viewDirection: SeatingViewDirectionEnum.FacingPlatform,
    seats,
    specialSeats,
    createdAt: '',
    updatedAt: ''
  }
}

describe('SeatingChartExportPreview', () => {
  it('renders the full static plan with title, platform, aisle and special seat', () => {
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart: createChart(),
        studentNames: {
          'student-1': '张三',
          'student-2': '李四'
        },
        showEmptyLabels: true
      }
    })

    expect(wrapper.get('.sheet-header h2').text()).toBe('一班座位表')
    expect(wrapper.find('.sheet-header').element.children).toHaveLength(1)
    expect(wrapper.text()).not.toContain('CLASSROOM SEATING PLAN')
    expect(wrapper.text()).not.toContain('学生视角 · 面向讲台')
    expect(wrapper.text()).not.toContain('2 排 × 2 列')
    expect(wrapper.text()).toContain('讲 台')
    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).toContain('李四')
    expect(wrapper.text()).toContain('空座位')
    expect(wrapper.findAll('.aisle:not(.aisle--header)')).toHaveLength(2)
    expect(wrapper.findAll('.export-seat')).toHaveLength(4)
  })

  it('keeps empty seat outlines while hiding labels and reverses the visible direction', () => {
    const chart = createChart()
    chart.viewDirection = SeatingViewDirectionEnum.FacingStudents
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart,
        studentNames: { 'student-1': '张三', 'student-2': '李四' },
        showEmptyLabels: false
      }
    })

    expect(wrapper.find('.classroom-plan').classes()).toContain('facing-students')
    expect(wrapper.findAll('.column-header').map((item) => item.text())).toEqual(['2列', '1列'])
    expect(wrapper.findAll('.export-seat')).toHaveLength(4)
    expect(wrapper.findAll('.export-seat').some((item) => item.text() === '空座位')).toBe(false)
  })
})
