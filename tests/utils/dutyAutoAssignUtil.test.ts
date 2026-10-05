import { describe, expect, it } from 'vitest'

import { autoAssignDuty, getDutyAutoSlots } from '../../src/utils/duty-roster/dutyAutoAssignUtil'
import { DutyPeriodEnum, DutyRosterModeEnum } from '../../src/types/DutyRoster'

import type { DutyRosterType } from '../../src/types/DutyRoster'

const createRoster = (): DutyRosterType => ({
  id: 'roster',
  name: '值日',
  mode: DutyRosterModeEnum.Weekly,
  studentSource: 'system',
  sections: [
    {
      id: 's',
      name: '教室',
      kind: 'indoor',
      sortOrder: 0,
      positions: [
        { id: 'p1', name: '扫地', sortOrder: 0 },
        { id: 'p2', name: '擦黑板', sortOrder: 1 }
      ]
    }
  ],
  weeklyRows: [{ id: 'w1', sortOrder: 0 }],
  assignments: [],
  leaders: [],
  notes: '',
  createdAt: '',
  updatedAt: ''
})
const random = () => 0.99

describe('值日自动分配', () => {
  it('人数超出容量时保留待选学生，不重复分配', () => {
    const roster = createRoster()
    const slots = getDutyAutoSlots(roster)
    const result = autoAssignDuty(
      roster,
      ['a', 'b', 'c'],
      Object.fromEntries(slots.map((slot) => [slot.key, 1])),
      false,
      random
    )
    expect(result.assignments.flatMap((item) => item.studentIds)).toEqual(['a', 'b'])
    expect(result.unassigned).toEqual(['c'])
    expect(result.vacancies).toBe(0)
    expect(roster.assignments).toEqual([])
  })
  it('容量过大时报告空缺，不凭空增加任务', () => {
    const roster = createRoster()
    const slots = getDutyAutoSlots(roster)
    const result = autoAssignDuty(
      roster,
      ['a'],
      Object.fromEntries(slots.map((slot) => [slot.key, 2])),
      false,
      random
    )
    expect(result.assignments.flatMap((item) => item.studentIds)).toEqual(['a'])
    expect(result.vacancies).toBe(3)
  })
  it('保留已排学生，即使该岗位新容量设为零', () => {
    const roster = createRoster()
    roster.assignments = [
      { period: DutyPeriodEnum.Weekly, rowId: 'w1', positionId: 'p1', studentIds: ['a'] }
    ]
    const slots = getDutyAutoSlots(roster)
    const result = autoAssignDuty(
      roster,
      ['a', 'b'],
      { [slots[0].key]: 0, [slots[1].key]: 1 },
      true,
      random
    )
    expect(result.assignments[0].studentIds).toEqual(['a'])
    expect(result.assignments[1].studentIds).toEqual(['b'])
  })
  it('尊重重复卡片配额，同一格不出现重复姓名身份', () => {
    const roster = createRoster()
    roster.studentCardCounts = { a: 2 }
    const slots = getDutyAutoSlots(roster)
    const result = autoAssignDuty(
      roster,
      ['a', 'b'],
      { [slots[0].key]: 2, [slots[1].key]: 1 },
      false,
      random
    )
    expect(result.assignments.map((item) => item.studentIds)).toEqual([['a', 'b'], ['a']])
    expect(result.unassigned).toEqual([])
  })
  it('按天生成五组，按周行区分岗位，不串行分配', () => {
    const roster = createRoster()
    roster.mode = DutyRosterModeEnum.Daily
    expect(getDutyAutoSlots(roster)).toHaveLength(10)
    roster.mode = DutyRosterModeEnum.Weekly
    roster.weeklyRows.push({ id: 'w2', sortOrder: 1 })
    const slots = getDutyAutoSlots(roster)
    expect(slots).toHaveLength(4)
    expect(new Set(slots.map((slot) => slot.key)).size).toBe(4)
  })
})
