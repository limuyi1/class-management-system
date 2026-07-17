import { describe, expect, it } from 'vitest'

import { DutyPeriodEnum, DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import {
  createDefaultDutySections,
  getDutyPeriods,
  normalizeDutyRoster
} from '@/utils/dutyRosterUntil'

function createRoster(): DutyRosterType {
  return {
    id: 'roster-1',
    name: '班级值日安排',
    mode: DutyRosterModeEnum.Daily,
    studentSource: 'system',
    sections: createDefaultDutySections(),
    weeklyRows: [{ id: 'weekly-row-1', sortOrder: 0 }],
    assignments: [],
    leaders: [],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('dutyRosterUntil', () => {
  it('keeps all five weekdays in daily mode and a hidden internal period in weekly mode', () => {
    expect(getDutyPeriods(DutyRosterModeEnum.Daily)).toEqual([
      DutyPeriodEnum.Monday,
      DutyPeriodEnum.Tuesday,
      DutyPeriodEnum.Wednesday,
      DutyPeriodEnum.Thursday,
      DutyPeriodEnum.Friday
    ])
    expect(getDutyPeriods(DutyRosterModeEnum.Weekly)).toEqual([DutyPeriodEnum.Weekly])
  })

  it('removes invalid and duplicate students while preserving the first assignment', () => {
    const roster = createRoster()
    const [firstPosition, secondPosition] = roster.sections[0].positions
    roster.assignments = [
      {
        period: DutyPeriodEnum.Monday,
        positionId: firstPosition.id,
        studentIds: ['student-1', 'missing']
      },
      {
        period: DutyPeriodEnum.Tuesday,
        positionId: secondPosition.id,
        studentIds: ['student-1', 'student-2']
      }
    ]

    const normalized = normalizeDutyRoster(roster, new Set(['student-1', 'student-2']))

    expect(normalized.assignments[0].studentIds).toEqual(['student-1'])
    expect(normalized.assignments[1].studentIds).toEqual(['student-2'])
  })

  it('removes a leader when the student is no longer assigned in that section', () => {
    const roster = createRoster()
    roster.leaders = [
      {
        period: DutyPeriodEnum.Monday,
        sectionId: roster.sections[0].id,
        studentId: 'student-1'
      }
    ]

    const normalized = normalizeDutyRoster(roster, new Set(['student-1']))

    expect(normalized.leaders).toEqual([])
  })

  it('migrates the old crown wording in saved notes', () => {
    const roster = createRoster()
    roster.notes = '皇冠图标及红色姓名表示值日组长\n组长负责检查卫生'

    const normalized = normalizeDutyRoster(roster, new Set())

    expect(normalized.notes).toBe('红色圆点及红色姓名表示值日组长\n组长负责检查卫生')
  })

  it('moves legacy weekly assignments into the first weekly row', () => {
    const roster = createRoster()
    roster.mode = DutyRosterModeEnum.Weekly
    roster.assignments = [
      {
        period: DutyPeriodEnum.Weekly,
        positionId: roster.sections[0].positions[0].id,
        studentIds: ['student-1']
      }
    ]

    const normalized = normalizeDutyRoster(roster, new Set(['student-1']))

    expect(normalized.assignments[0].rowId).toBe('weekly-row-1')
  })
})
