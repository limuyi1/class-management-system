import { describe, expect, it } from 'vitest'

import {
  buildExcelSeatingStudents,
  buildSystemSeatingStudents,
  resolveSeatingChartStudents
} from '@/utils/seating-chart/seatingChartStudentUtil'
import { SeatingFirstColumnSideEnum, type SeatingChartType } from '@/types/SeatingChart'
import { createSeats, createSpecialSeats } from '@/utils/seating-chart/seatingChartUtil'

const createChart = (): SeatingChartType => ({
  id: 'chart',
  name: '测试座位表',
  studentSource: 'excel',
  excelSource: {
    fileName: '名单.xlsx',
    students: [
      { id: 'excel:0', name: '张三' },
      { id: 'excel:1', name: '张三' }
    ]
  },
  rows: 2,
  columns: 2,
  aisleAfterColumns: [],
  firstColumnSide: SeatingFirstColumnSideEnum.Left,
  seats: createSeats(2, 2),
  specialSeats: createSpecialSeats(),
  createdAt: '',
  updatedAt: ''
})

describe('seatingChartStudentUtil', () => {
  it('builds system students with stable system IDs', () => {
    expect(
      buildSystemSeatingStudents([
        { studentId: 'student-1', name: '张三' },
        { studentId: 'student-2', name: null }
      ])
    ).toEqual([
      { id: 'student-1', name: '张三' },
      { id: 'student-2', name: '未命名学生' }
    ])
  })

  it('keeps duplicate Excel names and skips empty rows', () => {
    expect(
      buildExcelSeatingStudents([{ 姓名: ' 张三 ' }, { 姓名: '' }, { 姓名: '张三' }], '姓名')
    ).toEqual([
      { id: 'excel:0', name: '张三' },
      { id: 'excel:2', name: '张三' }
    ])
  })

  it('uses the roster bound to the active chart source', () => {
    const chart = createChart()
    const systemStudents = [{ studentId: 'system-1', name: '李四' }]

    expect(resolveSeatingChartStudents(chart, systemStudents)).toEqual(chart.excelSource?.students)
    chart.studentSource = 'system'
    expect(resolveSeatingChartStudents(chart, systemStudents)).toEqual([
      { id: 'system-1', name: '李四' }
    ])
  })
})
