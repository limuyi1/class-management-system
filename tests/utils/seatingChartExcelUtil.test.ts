import { describe, expect, it } from 'vitest'

import {
  SeatingFirstColumnSideEnum,
  SeatingPlatformPositionEnum,
  SeatingSpecialSeatPositionEnum
} from '@/types/SeatingChart'
import { buildSeatingChartExcelRows } from '@/utils/seating-chart/seatingChartExcelUtil'

import type { SeatingChartType } from '@/types/SeatingChart'

/** 构造包含反向列、过道、特殊座位和职务的座位表。 */
function createChart(): SeatingChartType {
  return {
    id: 'chart-1',
    name: '303 班座位表',
    studentSource: 'system',
    rows: 1,
    columns: 3,
    aisleAfterColumns: [1],
    firstColumnSide: SeatingFirstColumnSideEnum.Right,
    platformPosition: SeatingPlatformPositionEnum.Top,
    seats: [
      { row: 0, column: 0, studentId: 'student-1' },
      { row: 0, column: 1, studentId: null },
      { row: 0, column: 2, studentId: 'student-2' }
    ],
    specialSeats: [
      {
        position: SeatingSpecialSeatPositionEnum.PlatformLeft,
        enabled: true,
        studentId: 'student-3'
      },
      {
        position: SeatingSpecialSeatPositionEnum.PlatformRight,
        enabled: false,
        studentId: null
      }
    ],
    roleDefinitions: [
      {
        id: 'role-1',
        subject: '数学',
        title: '组长',
        groupName: '',
        shortLabel: '数组',
        color: '#3978D4',
        sortOrder: 0
      }
    ],
    roleAssignments: [{ studentId: 'student-2', roleIds: ['role-1'] }],
    notes: '每周轮换',
    createdAt: '',
    updatedAt: ''
  }
}

describe('seatingChartExcelUtil', () => {
  it('keeps display direction, aisle, roles, special seats and notes', () => {
    const rows = buildSeatingChartExcelRows(createChart(), {
      'student-1': '张三',
      'student-2': '李四',
      'student-3': '王五'
    })

    expect(rows[0]).toEqual(['303 班座位表'])
    expect(rows[1]).toEqual(['讲台左侧特殊座位', '王五', '讲台', '讲台右侧特殊座位', '未启用'])
    expect(rows[3]).toEqual(['排/列', '第 3 列', '过道', '第 2 列', '第 1 列'])
    expect(rows[4]).toEqual(['第 1 排', '李四\n数组', null, '空座位', '张三'])
    expect(rows).toContainEqual(['备注说明'])
    expect(rows).toContainEqual(['每周轮换'])
  })

  it('places the platform after rows and mirrors only row order in the bottom view', () => {
    const chart = createChart()
    chart.platformPosition = SeatingPlatformPositionEnum.Bottom
    chart.rows = 2
    chart.seats.push(
      { row: 1, column: 0, studentId: null },
      { row: 1, column: 1, studentId: null },
      { row: 1, column: 2, studentId: 'student-1' }
    )

    const rows = buildSeatingChartExcelRows(chart, {
      'student-1': '张三',
      'student-2': '李四',
      'student-3': '王五'
    })

    expect(rows[1]).toEqual(['第 2 排', '张三', null, '空座位', '空座位'])
    expect(rows[2][0]).toBe('第 1 排')
    expect(rows[3]).toEqual(['排/列', '第 3 列', '过道', '第 2 列', '第 1 列'])
    expect(rows[5]).toEqual([
      '讲台左侧特殊座位',
      '王五',
      '讲台',
      '讲台右侧特殊座位',
      '未启用'
    ])
  })
})
