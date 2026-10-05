import { describe, expect, it } from 'vitest'

import {
  rotateSeatingChart,
  SeatingRotationDirectionEnum as Direction
} from '../../src/utils/seating-chart/seatingRotationUtil'
import {
  SeatingFirstColumnSideEnum,
  SeatingPlatformPositionEnum
} from '../../src/types/SeatingChart'

import type { SeatingChartType } from '../../src/types/SeatingChart'

const createChart = (): SeatingChartType => ({
  id: 'chart',
  name: '座位',
  studentSource: 'system',
  rows: 3,
  columns: 2,
  aisleAfterColumns: [],
  firstColumnSide: SeatingFirstColumnSideEnum.Left,
  platformPosition: SeatingPlatformPositionEnum.Top,
  seats: ['a', 'b', 'c', 'd', 'e', null].map((studentId, index) => ({
    row: Math.floor(index / 2),
    column: index % 2,
    studentId
  })),
  specialSeats: [],
  roleDefinitions: [],
  roleAssignments: [],
  notes: '',
  createdAt: '',
  updatedAt: ''
})

describe('座位循环轮换', () => {
  it('固定学生与空位原地保留，不改变原方案，也不丢失或重复学生', () => {
    const chart = createChart()
    const original = structuredClone(chart)
    const seats = rotateSeatingChart(chart, Direction.Forward, 1, ['c'])
    expect(seats.map((seat) => seat.studentId)).toEqual(['e', 'd', 'c', 'b', 'a', null])
    expect(chart).toEqual(original)
    expect(seats.map((seat) => seat.studentId).sort()).toEqual(
      chart.seats.map((seat) => seat.studentId).sort()
    )
  })
  it('讲台上下只改变显示顺序，靠近讲台仍朝第零排循环', () => {
    const chart = createChart()
    const top = rotateSeatingChart(chart, Direction.Forward, 1, [])
    chart.platformPosition = SeatingPlatformPositionEnum.Bottom
    expect(rotateSeatingChart(chart, Direction.Forward, 1, [])).toEqual(top)
  })
  it('多次循环可回到原方案，并正确处理首列在右', () => {
    const chart = createChart()
    chart.rows = 1
    chart.columns = 3
    chart.seats = ['a', 'b', 'c'].map((studentId, column) => ({ row: 0, column, studentId }))
    expect(rotateSeatingChart(chart, Direction.Left, 3, [])).toEqual(chart.seats)
    chart.firstColumnSide = SeatingFirstColumnSideEnum.Right
    expect(rotateSeatingChart(chart, Direction.Left, 1, []).map((seat) => seat.studentId)).toEqual([
      'c',
      'a',
      'b'
    ])
  })
  it('重复占座时拒绝生成，避免掩盖错误名单', () => {
    const chart = createChart()
    chart.seats[1].studentId = 'a'
    expect(() => rotateSeatingChart(chart, Direction.Forward, 1, [])).toThrow('重复学生')
  })
})
