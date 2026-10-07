/**
 * dutyRosterStudentUtil 测试
 * 覆盖值日表学生名单处理：系统学生转换（buildSystemDutyStudents）、
 * Excel 行构建（buildExcelDutyStudents）与名单解析（resolveDutyRosterStudents）。
 */

import { describe, expect, it } from 'vitest'

import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import type { StudentDataType } from '@/types/StudentData'

import {
  buildExcelDutyStudents,
  buildSystemDutyStudents,
  resolveDutyRosterStudents
} from '@/utils/duty-roster/dutyRosterStudentUtil'

// 构造可覆盖默认值的最小值日表数据，供各用例复用
const createRoster = (overrides: Partial<DutyRosterType> = {}): DutyRosterType => ({
  id: 'r1',
  name: '值日表',
  mode: DutyRosterModeEnum.Daily,
  studentSource: 'system',
  sections: [],
  weeklyRows: [],
  assignments: [],
  leaders: [],
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

// 系统来源：将系统学生转为名单结构，处理空姓名与首尾空白
describe('buildSystemDutyStudents', () => {
  it('将系统学生转换为最小名单结构', () => {
    const students: StudentDataType[] = [
      { studentId: '1', name: '张三' },
      { studentId: '2', name: null },
      { studentId: '3', name: '  李四  ' }
    ]

    expect(buildSystemDutyStudents(students)).toEqual([
      { id: '1', name: '张三' },
      { id: '2', name: '未命名学生' },
      { id: '3', name: '李四' }
    ])
  })
})

// Excel 来源：按行顺序构建名单并跳过空姓名行
describe('buildExcelDutyStudents', () => {
  it('按行顺序建立名单并跳过空姓名', () => {
    const rows = [
      { 姓名: '张三' },
      { 姓名: '' },
      { 姓名: '   ' },
      { 姓名: '李四' }
    ]

    expect(buildExcelDutyStudents(rows, '姓名')).toEqual([
      { id: 'excel:0', name: '张三' },
      { id: 'excel:3', name: '李四' }
    ])
  })
})

// 名单解析：根据值日表来源（系统/Excel）返回对应名单，无值日表时返回空数组
describe('resolveDutyRosterStudents', () => {
  const systemStudents: StudentDataType[] = [{ studentId: '1', name: '张三' }]

  it('无值日表时返回空数组', () => {
    expect(resolveDutyRosterStudents(null, systemStudents)).toEqual([])
  })

  it('Excel 来源时返回 Excel 名单快照', () => {
    const roster = createRoster({
      studentSource: 'excel',
      excelSource: { fileName: 'a.xlsx', students: [{ id: 'excel:0', name: '张三' }] }
    })

    expect(resolveDutyRosterStudents(roster, systemStudents)).toEqual([
      { id: 'excel:0', name: '张三' }
    ])
  })

  it('系统来源时从系统学生构建名单', () => {
    const roster = createRoster({ studentSource: 'system' })

    expect(resolveDutyRosterStudents(roster, systemStudents)).toEqual([
      { id: '1', name: '张三' }
    ])
  })
})
