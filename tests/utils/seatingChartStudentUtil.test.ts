/**
 * 测试 seatingChartStudentUtil 模块。
 * 覆盖：系统学生名单构建（稳定 ID、空名回退）、Excel 名单构建（去空格、跳过空行），
 * 以及按座位表数据源解析当前使用的名单。
 */
import { describe, expect, it } from 'vitest'

import {
  buildExcelSeatingStudents,
  buildSystemSeatingStudents,
  resolveSeatingChartStudents
} from '@/utils/seating-chart/seatingChartStudentUtil'
import { SeatingFirstColumnSideEnum, type SeatingChartType } from '@/types/SeatingChart'
import { createSeats, createSpecialSeats } from '@/utils/seating-chart/seatingChartUtil'

// 构造以 Excel 名单为数据源、包含两名重名学生的测试座位表
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

// 座位表学生名单工具函数测试组
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
