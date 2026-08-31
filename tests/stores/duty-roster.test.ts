import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { DutyPeriodEnum, DutyRosterModeEnum } from '@/types/DutyRoster'

/**
 * useDutyRosterStore store 测试
 * 测试目标：值日安排 store
 * 覆盖功能：学生分配与岗位复用、多组长设置、删除岗位/周行后的学生回收、每日/每周模式切换、区域与周行排序
 */
describe('useDutyRosterStore', () => {
  // 每个用例前创建全新的 Pinia 实例，隔离 store 状态
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

  it('adds and removes students from only the current Excel roster', () => {
    const store = useDutyRosterStore()
    const roster = store.createRoster({
      studentSource: 'excel',
      excelSource: {
        fileName: '名单.xlsx',
        students: [
          { id: 'excel:0', name: '张三' },
          { id: 'excel:1', name: '李四' }
        ]
      }
    })
    const positionId = roster.sections[0].positions[0].id
    store.assignStudent('excel:0', { period: DutyPeriodEnum.Monday, positionId })
    store.toggleLeader('excel:0')

    const added = store.addExcelStudent(' 王五 ')

    expect(added).toMatchObject({ name: '王五' })
    expect(added?.id).toMatch(/^manual:/)
    expect(store.unassignedStudents.map((student) => student.name)).toEqual(['李四', '王五'])
    expect(roster.assignments[0].studentIds).toEqual(['excel:0'])
    expect(roster.leaders).toHaveLength(1)

    expect(store.removeExcelStudent('excel:0')).toBe(true)
    expect(roster.excelSource?.students.map((student) => student.name)).toEqual(['李四', '王五'])
    expect(roster.assignments).toEqual([])
    expect(roster.leaders).toEqual([])
  })

  it('does not edit the system student source through Excel roster actions', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    store.createRoster({ studentSource: 'system' })

    expect(store.addExcelStudent('李四')).toBeNull()
    expect(store.removeExcelStudent('student-1')).toBe(false)
    expect(dataStore.students).toEqual([{ studentId: 'student-1', name: '张三' }])
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

  it('moves the leader role with the student and keeps existing target group leaders', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四' }
    ]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const indoorSection = roster.sections[0]
    const cleaningSection = roster.sections[1]
    const indoorPositionId = indoorSection.positions[0].id
    const cleaningPositionId = cleaningSection.positions[0].id

    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Monday,
      positionId: indoorPositionId
    })
    store.toggleLeader('student-1')
    store.assignStudent('student-2', {
      period: DutyPeriodEnum.Tuesday,
      positionId: cleaningPositionId
    })
    store.toggleLeader('student-2')

    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Tuesday,
      positionId: cleaningPositionId
    })

    expect(roster.leaders).toEqual([
      {
        period: DutyPeriodEnum.Tuesday,
        sectionId: cleaningSection.id,
        studentId: 'student-2'
      },
      {
        period: DutyPeriodEnum.Tuesday,
        sectionId: cleaningSection.id,
        studentId: 'student-1'
      }
    ])
  })

  it('allows multiple leaders in the same period and section', () => {
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

    expect(roster.leaders.map((leader) => leader.studentId)).toEqual(['student-1', 'student-2'])
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
