import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { DutyPeriodEnum, DutyRosterModeEnum } from '@/types/DutyRoster'

describe('useDutyRosterStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses enabled system students and permits several students in one duty', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四' }
    ]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const positionId = roster.sections[0].positions[0].id

    store.assignStudent('student-1', { period: DutyPeriodEnum.Monday, positionId })
    store.assignStudent('student-2', { period: DutyPeriodEnum.Monday, positionId })

    expect(store.assignedCount).toBe(2)
    expect(roster.assignments[0].studentIds).toEqual(['student-1', 'student-2'])
    expect(store.unassignedStudents).toEqual([])
  })

  it('moves a student instead of duplicating the student', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const [firstPosition, secondPosition] = roster.sections[0].positions

    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Monday,
      positionId: firstPosition.id
    })
    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Tuesday,
      positionId: secondPosition.id
    })

    expect(store.assignedStudentIds).toEqual(['student-1'])
    expect(roster.assignments).toEqual([
      {
        period: DutyPeriodEnum.Tuesday,
        positionId: secondPosition.id,
        studentIds: ['student-1']
      }
    ])
  })

  it('allows only one leader in the same period and section', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四' }
    ]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const [firstPosition, secondPosition] = roster.sections[0].positions
    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Monday,
      positionId: firstPosition.id
    })
    store.assignStudent('student-2', {
      period: DutyPeriodEnum.Monday,
      positionId: secondPosition.id
    })

    store.toggleLeader('student-1')
    store.toggleLeader('student-2')

    expect(roster.leaders).toHaveLength(1)
    expect(roster.leaders[0].studentId).toBe('student-2')
  })

  it('returns students to the unassigned list after deleting a position', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const positionId = roster.sections[0].positions[0].id
    store.assignStudent('student-1', { period: DutyPeriodEnum.Monday, positionId })
    store.toggleLeader('student-1')

    store.removePosition(positionId)

    expect(store.assignedCount).toBe(0)
    expect(roster.leaders).toEqual([])
    expect(store.unassignedStudents.map((student) => student.id)).toEqual(['student-1'])
  })

  it('clears assignments when switching between daily and weekly modes', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Monday,
      positionId: roster.sections[0].positions[0].id
    })

    store.setMode(DutyRosterModeEnum.Weekly)

    expect(roster.mode).toBe(DutyRosterModeEnum.Weekly)
    expect(roster.assignments).toEqual([])
  })

  it('reorders whole duty sections independently from their positions', () => {
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const [indoor, cleaning] = roster.sections

    store.reorderSections([cleaning.id, indoor.id])

    expect(roster.sections.map((section) => section.id)).toEqual([cleaning.id, indoor.id])
    expect(roster.sections.map((section) => section.sortOrder)).toEqual([0, 1])
    expect(roster.sections[1].positions[0].name).toBe('一组+讲台')
  })

  it('adds weekly rows at an anchor and returns students after deleting a row', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({
      mode: DutyRosterModeEnum.Weekly,
      studentSource: 'system'
    })
    const firstRowId = roster.weeklyRows[0].id
    const secondRowId = store.addWeeklyRow(firstRowId)

    expect(secondRowId).not.toBeNull()
    expect(roster.weeklyRows).toHaveLength(2)
    expect(roster.weeklyRows[1].id).toBe(secondRowId)

    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Weekly,
      rowId: secondRowId!,
      positionId: roster.sections[0].positions[0].id
    })
    store.toggleLeader('student-1')
    store.removeWeeklyRow(secondRowId!)

    expect(roster.weeklyRows).toHaveLength(1)
    expect(store.assignedCount).toBe(0)
    expect(roster.leaders).toEqual([])
    expect(store.unassignedStudents.map((student) => student.id)).toEqual(['student-1'])
  })

  it('keeps the final weekly row', () => {
    const store = useDutyRosterStore()
    const roster = store.createRoster({
      mode: DutyRosterModeEnum.Weekly,
      studentSource: 'system'
    })

    store.removeWeeklyRow(roster.weeklyRows[0].id)

    expect(roster.weeklyRows).toHaveLength(1)
  })
})
