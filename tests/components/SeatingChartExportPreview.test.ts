import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import SeatingChartExportPreview from '@/views/seating-chart/components/SeatingChartExportPreview.vue'
import { PagesEnum } from '@/types/Common'
import {
  SeatingFirstColumnSideEnum,
  SeatingSpecialSeatPositionEnum,
  type SeatingChartType
} from '@/types/SeatingChart'
import { createSeats, createSpecialSeats } from '@/utils/seating-chart/seatingChartUtil'

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
    studentSource: 'system',
    rows: 2,
    columns: 2,
    aisleAfterColumns: [0],
    firstColumnSide: SeatingFirstColumnSideEnum.Left,
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
    expect(wrapper.findAll('.platform-area > *')).toHaveLength(2)
    expect(wrapper.find('.special-seat-slot--left').exists()).toBe(true)
    expect(wrapper.find('.special-seat-slot--right').exists()).toBe(false)
    expect(wrapper.findAll('.aisle:not(.aisle--header)')).toHaveLength(2)
    expect(wrapper.findAll('.export-seat')).toHaveLength(4)
  })

  it('keeps empty seat outlines while hiding labels and places the first column on the right', () => {
    const chart = createChart()
    chart.firstColumnSide = SeatingFirstColumnSideEnum.Right
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart,
        studentNames: { 'student-1': '张三', 'student-2': '李四' },
        showEmptyLabels: false
      }
    })

    expect(wrapper.find('.classroom-plan > .platform-area').exists()).toBe(true)
    expect(wrapper.findAll('.column-header').map((item) => item.text())).toEqual(['2列', '1列'])
    expect(wrapper.findAll('.export-seat')).toHaveLength(4)
    expect(wrapper.findAll('.export-seat').some((item) => item.text() === '空座位')).toBe(false)
  })

  it('renders a paper canvas using the selected page orientation', () => {
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart: createChart(),
        studentNames: {},
        showEmptyLabels: true,
        pageType: PagesEnum.A4,
        orientation: 'portrait'
      }
    })

    const paperStyle = wrapper.get('.seating-export-sheet').attributes('style')
    expect(paperStyle).toContain('width: 595.28px')
    expect(paperStyle).toContain('height: 841.89px')
  })

  it('updates all paper content without changing the paper size', async () => {
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart: createChart(),
        studentNames: {},
        showEmptyLabels: true,
        layoutScalePercent: 100
      }
    })
    const originalStyle = wrapper.get('.seating-export-content').attributes('style')

    const originalPaperStyle = wrapper.get('.seating-export-sheet').attributes('style')
    await wrapper.setProps({ layoutScalePercent: 90 })

    expect(wrapper.get('.seating-export-content').attributes('style')).not.toBe(originalStyle)
    expect(wrapper.get('.seating-export-sheet').attributes('style')).toBe(originalPaperStyle)
  })

  it('hides the title and its divider together', () => {
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart: createChart(),
        studentNames: {},
        showTitle: false,
        showEmptyLabels: true
      }
    })

    expect(wrapper.find('.sheet-header').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('一班座位表')
    expect(wrapper.find('.classroom-plan').exists()).toBe(true)
  })
})
