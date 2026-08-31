import { describe, expect, it } from 'vitest'

import { DutyPeriodEnum, DutyRosterModeEnum } from '@/types/DutyRoster'
import { buildDutyRosterExcelRows } from '@/utils/duty-roster/dutyRosterExcelUtil'

import type { DutyRosterType } from '@/types/DutyRoster'

/** 构造包含区域、岗位、组长与备注的最小每日值日表。 */
function createRoster(): DutyRosterType {
  return {
    id: 'roster-1',
    name: '303 班值日表',
    mode: DutyRosterModeEnum.Daily,
    studentSource: 'system',
    sections: [
      {
        id: 'section-1',
        name: '教室',
        kind: 'indoor',
        sortOrder: 0,
        positions: [{ id: 'position-1', name: '讲台', sortOrder: 0 }]
      }
    ],
    weeklyRows: [{ id: 'weekly-row-1', sortOrder: 0 }],
    assignments: [
      {
        period: DutyPeriodEnum.Monday,
        positionId: 'position-1',
        studentIds: ['student-1', 'student-2']
      }
    ],
    leaders: [
      {
        period: DutyPeriodEnum.Monday,
        sectionId: 'section-1',
        studentId: 'student-1'
      }
    ],
    notes: '完成后检查\n关好门窗',
    createdAt: '',
    updatedAt: ''
  }
}

describe('dutyRosterExcelUtil', () => {
  it('builds a readable daily roster with leader marks and notes', () => {
    const rows = buildDutyRosterExcelRows(createRoster(), {
      'student-1': '张三',
      'student-2': '李四'
    })

    expect(rows[0]).toEqual(['303 班值日表'])
    expect(rows[3]).toEqual(['值日周期', '教室'])
    expect(rows[4]).toEqual(['', '讲台'])
    expect(rows[5]).toEqual(['星期一', '张三（组长）、李四'])
    expect(rows).toContainEqual(['备注说明'])
    expect(rows).toContainEqual(['关好门窗'])
  })

  it('uses ordered group labels for weekly rosters', () => {
    const roster = createRoster()
    roster.mode = DutyRosterModeEnum.Weekly
    roster.assignments = [
      {
        period: DutyPeriodEnum.Weekly,
        rowId: 'weekly-row-1',
        positionId: 'position-1',
        studentIds: ['student-1']
      }
    ]
    roster.leaders = []

    const rows = buildDutyRosterExcelRows(roster, { 'student-1': '张三' })
    expect(rows[5]).toEqual(['第 1 组', '张三'])
  })
})
