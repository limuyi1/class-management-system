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

/**
 * SeatingChartExportPreview 组件测试
 * 测试目标：座位表导出预览（打印稿）
 * 覆盖功能：标题/讲台/过道/特殊座位的静态渲染、空座位标签显隐、纸张方向与内容缩放、标题显隐
 */

/** 构造 2 排 × 2 列的座位表：普通座一名学生、讲台左侧特殊座一名学生 */
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
    roleDefinitions: [],
    roleAssignments: [],
    notes: '',
    createdAt: '',
    updatedAt: ''
  }
}

// 验证导出打印稿的静态渲染与缩放/显隐配置
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

  it('renders student roles, the legend and notes when enabled', () => {
    const chart = createChart()
    chart.roleDefinitions = [
      {
        id: 'role-1',
        subject: '英语',
        title: '副组长',
        groupName: '二组',
        shortLabel: '英2副',
        color: '#228B62',
        sortOrder: 0
      }
    ]
    chart.roleAssignments = [{ studentId: 'student-1', roleIds: ['role-1'] }]
    chart.notes = '第一排为视力调整座位\n每周轮换一次'
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart,
        studentNames: { 'student-1': '张三' },
        showEmptyLabels: true
      }
    })

    expect(wrapper.get('.export-seat-roles').text()).toContain('英2副')
    expect(wrapper.get('.role-legend').text()).toContain('英语二组副组长')
    expect(wrapper.get('.sheet-notes').text()).toContain('每周轮换一次')
  })

  it('can hide roles, the legend and notes from the export', () => {
    const chart = createChart()
    chart.roleDefinitions = [
      {
        id: 'role-1',
        subject: '语文',
        title: '组长',
        groupName: '',
        shortLabel: '语组',
        color: '#D94B4B',
        sortOrder: 0
      }
    ]
    chart.roleAssignments = [{ studentId: 'student-1', roleIds: ['role-1'] }]
    chart.notes = '备注内容'
    const wrapper = mount(SeatingChartExportPreview, {
      props: {
        chart,
        studentNames: { 'student-1': '张三' },
        showEmptyLabels: true,
        showRoles: false,
        showLegend: false,
        showNotes: false
      }
    })

    expect(wrapper.find('.export-seat-roles').exists()).toBe(false)
    expect(wrapper.find('.sheet-annotations').exists()).toBe(false)
  })
})
