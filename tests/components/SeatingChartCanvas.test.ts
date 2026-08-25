import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import SeatingChartCanvas from '@/views/seating-chart/components/SeatingChartCanvas.vue'
import {
  SeatingFirstColumnSideEnum,
  SeatingSpecialSeatPositionEnum,
  type SeatingChartType
} from '@/types/SeatingChart'
import { createSeats, createSpecialSeats } from '@/utils/seating-chart/seatingChartUtil'

/**
 * SeatingChartCanvas 组件测试
 * 测试目标：座位表画布（可编辑视图）
 * 覆盖功能：讲台区域位置、行列坐标轴与过道、首列左右切换、座位点击选择事件
 */

// 模拟 ResizeObserver：组件挂载时依赖它监听画布尺寸变化
class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

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
    name: '测试座位表',
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

// 验证座位画布的布局结构与交互事件
describe('SeatingChartCanvas', () => {
  // 注入 ResizeObserver 替身，用例结束后恢复全部全局替身
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the platform outside the seat scroller and renders coordinate chips and aisle', () => {
    const chart = createChart()
    const wrapper = mount(SeatingChartCanvas, {
      props: {
        chart,
        visibleSeatRows: [chart.seats.slice(0, 2), chart.seats.slice(2, 4)],
        studentNames: new Map([
          ['student-1', '张三'],
          ['student-2', '李四']
        ]),
        selectedStudentId: null
      }
    })

    expect(wrapper.find('.platform-shell').exists()).toBe(true)
    expect(wrapper.find('.seat-viewport .platform').exists()).toBe(false)
    expect(wrapper.text()).toContain('1列')
    expect(wrapper.text()).toContain('1排')
    expect(wrapper.findAll('.seat-axis-number')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('过道')
    expect(wrapper.text()).toContain('左')
    expect(wrapper.text()).not.toContain('雅座')
    expect(wrapper.text()).not.toContain('讲台左侧')
  })

  it('reverses only columns while keeping the platform above the first row', async () => {
    const chart = createChart()
    chart.firstColumnSide = SeatingFirstColumnSideEnum.Right
    // 首列在右侧时，每行座位按倒序排列以保持“面向讲台”的视角
    const visibleSeatRows = [
      [chart.seats[1], chart.seats[0]],
      [chart.seats[3], chart.seats[2]]
    ]
    const wrapper = mount(SeatingChartCanvas, {
      props: {
        chart,
        visibleSeatRows,
        studentNames: new Map([['student-1', '张三']]),
        selectedStudentId: null
      }
    })

    expect(wrapper.find('.platform-shell').element.nextElementSibling).toBe(
      wrapper.find('.seat-viewport').element
    )
    expect(wrapper.findAll('.seat-column-header').map((item) => item.text())).toEqual([
      '2列',
      '1列'
    ])

    await wrapper.find('.seat-row .seat').trigger('click')
    expect(wrapper.emitted('selectSeat')?.[0]).toEqual([chart.seats[1]])
  })
})
