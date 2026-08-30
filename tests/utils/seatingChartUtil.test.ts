/**
 * 测试 seatingChartUtil 模块。
 * 覆盖：座位创建与缩放、无效绑定与无效过道位置的归一化、随机/补充排座、
 * 特殊座位固定、空位保留在末行以及旧版 viewDirection 字段迁移。
 */
import { describe, expect, it } from 'vitest'

import {
  SeatingFirstColumnSideEnum,
  SeatingSpecialSeatPositionEnum,
  type SeatingChartType
} from '@/types/SeatingChart'
import {
  createRandomSeats,
  createSeats,
  createSpecialSeats,
  getVisibleSeats,
  normalizeChart,
  resizeSeats
} from '@/utils/seating-chart/seatingChartUtil'

// 构造指定行列数的测试座位表，行列坐标稳定便于断言
const chart = (rows = 2, columns = 2): SeatingChartType => ({
  id: 'chart',
  name: '测试',
  rows,
  columns,
  aisleAfterColumns: [],
  studentSource: 'system',
  firstColumnSide: SeatingFirstColumnSideEnum.Left,
  seats: createSeats(rows, columns),
  specialSeats: createSpecialSeats(),
  roleDefinitions: [],
  roleAssignments: [],
  notes: '',
  createdAt: '',
  updatedAt: ''
})

// 座位表核心工具函数测试组
describe('seatingChartUtil', () => {
  it('creates stable row-column coordinates and preserves in-bound seats on resize', () => {
    const source = chart()
    source.seats[0].studentId = 'student-1'
    expect(resizeSeats(source, 3, 2)).toHaveLength(6)
    expect(resizeSeats(source, 1, 1)[0].studentId).toBe('student-1')
  })

  it('normalizes invalid bindings and invalid aisle positions', () => {
    const source = chart()
    source.seats[0].studentId = 'valid'
    source.seats[1].studentId = 'valid'
    source.seats[2].studentId = 'removed'
    source.aisleAfterColumns = [0, 0, 1]
    const result = normalizeChart(source, new Set(['valid']))
    expect(result.seats.filter((seat) => seat.studentId === 'valid')).toHaveLength(1)
    expect(result.aisleAfterColumns).toEqual([0])
  })

  it('randomizes only available capacity and reverses columns without reversing rows', () => {
    const source = chart(1, 2)
    const random = createRandomSeats(source, ['a', 'b', 'c'])
    expect(random.seats.filter((seat) => seat.studentId)).toHaveLength(2)
    expect(random.unassignedCount).toBe(1)
    expect(random.unassignedStudentIds).toHaveLength(1)
    expect(['a', 'b', 'c']).toContain(random.unassignedStudentIds[0])
    source.firstColumnSide = SeatingFirstColumnSideEnum.Right
    expect(getVisibleSeats(source).map((seat) => seat.column)).toEqual([1, 0])
  })

  // 旧版 viewDirection 字段迁移为 firstColumnSide 朝向
  it('migrates the legacy view direction to the matching first-column side', () => {
    const source = chart()
    const legacyChart = { ...source, viewDirection: 'facing-students' }
    delete (legacyChart as Partial<SeatingChartType>).firstColumnSide

    const result = normalizeChart(legacyChart as SeatingChartType, new Set())

    expect(result.firstColumnSide).toBe(SeatingFirstColumnSideEnum.Right)
    expect('viewDirection' in result).toBe(false)
  })

  it('adds default roles to legacy charts while preserving an intentionally empty role list', () => {
    const legacyChart = chart()
    delete (legacyChart as Partial<SeatingChartType>).roleDefinitions

    expect(normalizeChart(legacyChart, new Set()).roleDefinitions).toHaveLength(9)
    expect(normalizeChart(chart(), new Set()).roleDefinitions).toEqual([])
  })

  it('keeps enabled special-seat students fixed during randomization', () => {
    const source = chart(1, 2)
    const specialSeat = source.specialSeats.find(
      (seat) => seat.position === SeatingSpecialSeatPositionEnum.PlatformLeft
    )!
    specialSeat.enabled = true
    specialSeat.studentId = 'a'
    const random = createRandomSeats(source, ['a', 'b', 'c'])
    expect(specialSeat.studentId).toBe('a')
    expect(random.randomizedStudentIds).toEqual(expect.arrayContaining(['b', 'c']))
    expect(random.randomizedStudentIds).not.toContain('a')
  })

  it('keeps empty seats at the end of the last row after full randomization', () => {
    const source = chart(2, 3)
    const random = createRandomSeats(source, ['a', 'b', 'c', 'd'])

    expect(random.seats.slice(0, 4).every((seat) => seat.studentId)).toBe(true)
    expect(random.seats.slice(4).map((seat) => [seat.row, seat.column, seat.studentId])).toEqual([
      [1, 1, null],
      [1, 2, null]
    ])
  })

  it('fills earlier empty seats first without moving existing assignments in supplement mode', () => {
    const source = chart(2, 2)
    source.seats[1].studentId = 'fixed'
    const random = createRandomSeats(source, ['fixed', 'new'], true)

    expect(random.seats[0].studentId).toBe('new')
    expect(random.seats[1].studentId).toBe('fixed')
    expect(random.seats.slice(2).every((seat) => !seat.studentId)).toBe(true)
  })
})
