import { expect, it } from 'vitest'
import { createClassroomTool } from '@/utils/apiClassroomToolUtil'
import {
  captureDutyCardCounts,
  moveClassroomSeat,
  reconcileDutyStructure,
  removeDutyWeeklyRow,
  setDutyCardCount
} from '@/utils/apiClassroomInteractionUtil'
import {
  moveDutyStudent,
  removeDutyStudentAssignment
} from '@/utils/duty-roster/dutyRosterAssignmentUtil'
import { DutyPeriodEnum, DutyRosterModeEnum } from '@/types/DutyRoster'
import type { SeatingChartType } from '@/types/SeatingChart'
import type { DutyRosterType } from '@/types/DutyRoster'

it('拖到占用座位交换学生，拖入未安排学生释放原学生，雅座也能交换', () => {
  const chart = createClassroomTool('seating') as SeatingChartType
  chart.seats[0].studentId = 'a'
  chart.seats[1].studentId = 'b'
  moveClassroomSeat(chart, 'a', chart.seats[1])
  expect(chart.seats.slice(0, 2).map((row) => row.studentId)).toEqual(['b', 'a'])
  moveClassroomSeat(chart, 'c', chart.seats[0])
  expect(chart.seats[0].studentId).toBe('c')
  chart.specialSeats[0].enabled = true
  chart.specialSeats[0].studentId = 'd'
  moveClassroomSeat(chart, 'a', chart.specialSeats[0])
  expect(chart.seats[1].studentId).toBe('d')
  expect(chart.specialSeats[0].studentId).toBe('a')
})
it('复制卡片换岗和回收不丢失数量，清理不在岗组长与过期容量', () => {
  const roster = createClassroomTool('duty') as DutyRosterType
  const [first, second] = roster.sections[0].positions
  const source = { period: DutyPeriodEnum.Monday, positionId: first.id }
  const target = { period: DutyPeriodEnum.Tuesday, positionId: second.id }
  roster.assignments = [
    { ...source, studentIds: ['a'] },
    { period: DutyPeriodEnum.Friday, positionId: first.id, studentIds: ['a'] }
  ]
  roster.leaders = [{ period: source.period, sectionId: roster.sections[0].id, studentId: 'a' }]
  captureDutyCardCounts(roster)
  expect(roster.studentCardCounts?.a).toBe(2)
  moveDutyStudent(roster, 'a', source, target)
  expect(roster.leaders[0].period).toBe(DutyPeriodEnum.Tuesday)
  removeDutyStudentAssignment(roster, 'a', target)
  expect(roster.studentCardCounts?.a).toBe(2)
  expect(roster.leaders).toEqual([])
  roster.autoAssignCapacities = { missing: 5, [`friday::${first.id}`]: 2 }
  reconcileDutyStructure(roster)
  expect(roster.autoAssignCapacities).toEqual({ [`friday::${first.id}`]: 2 })
  expect(() => setDutyCardCount(roster, 'a', 101)).toThrow('1～100')
})
it('删除周表组按 ID 清除对应安排，其他组身份和数量保持', () => {
  const roster = createClassroomTool('duty') as DutyRosterType
  roster.mode = DutyRosterModeEnum.Weekly
  roster.weeklyRows = [
    { id: 'one', sortOrder: 0 },
    { id: 'two', sortOrder: 1 }
  ]
  const positionId = roster.sections[0].positions[0].id
  roster.assignments = ['one', 'two'].map((rowId) => ({
    period: DutyPeriodEnum.Weekly,
    rowId,
    positionId,
    studentIds: ['a']
  }))
  roster.autoAssignCapacities = { [`weekly:one:${positionId}`]: 3, [`weekly:two:${positionId}`]: 4 }
  removeDutyWeeklyRow(roster, 'one')
  expect(roster.weeklyRows).toEqual([{ id: 'two', sortOrder: 0 }])
  expect(roster.assignments[0].rowId).toBe('two')
  expect(roster.studentCardCounts?.a).toBe(2)
  expect(Object.values(roster.autoAssignCapacities!)).toEqual([4])
})
