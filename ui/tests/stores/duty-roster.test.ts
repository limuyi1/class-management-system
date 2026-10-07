import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { DutyPeriodEnum, DutyRosterModeEnum } from '@/types/DutyRoster'

/**
 * useDutyRosterStore store 测试
 * 测试目标：值日安排 store
 * 覆盖功能：卡片复制/删除/移动、区域组长、岗位回收、模式切换与区域/周行排序
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
    store.toggleLeader('excel:0', { period: DutyPeriodEnum.Monday, positionId })

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

  it('allows a student in different duties while preventing duplicates in one duty', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const [firstPosition, secondPosition] = roster.sections[0].positions

    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Monday,
      positionId: firstPosition.id
    })
    store.copyStudentCard('student-1')
    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Tuesday,
      positionId: secondPosition.id
    })
    store.assignStudent('student-1', {
      period: DutyPeriodEnum.Tuesday,
      positionId: secondPosition.id
    })

    expect(store.assignedStudentIds).toEqual(['student-1', 'student-1'])
    expect(store.assignedCount).toBe(1)
    expect(roster.assignments).toEqual([
      {
        period: DutyPeriodEnum.Monday,
        positionId: firstPosition.id,
        studentIds: ['student-1']
      },
      {
        period: DutyPeriodEnum.Tuesday,
        positionId: secondPosition.id,
        studentIds: ['student-1']
      }
    ])
  })

  it('copies and deletes pending cards while always keeping one total card', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })

    store.deletePendingStudentCard('student-1')
    expect(store.pendingStudentCounts['student-1']).toBe(1)

    store.copyStudentCard('student-1')
    store.copyStudentCard('student-1')
    expect(store.pendingStudentCounts['student-1']).toBe(3)

    store.deletePendingStudentCard('student-1')
    expect(roster.studentCardCounts?.['student-1']).toBe(2)
    expect(store.pendingStudentCounts['student-1']).toBe(2)
  })

  it('moves and removes only the selected assigned card', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const [firstPosition, secondPosition, thirdPosition] = roster.sections[0].positions
    const firstTarget = { period: DutyPeriodEnum.Monday, positionId: firstPosition.id }
    const secondTarget = { period: DutyPeriodEnum.Tuesday, positionId: secondPosition.id }
    const thirdTarget = { period: DutyPeriodEnum.Wednesday, positionId: thirdPosition.id }

    store.assignStudent('student-1', firstTarget)
    store.copyStudentCard('student-1')
    store.assignStudent('student-1', secondTarget)
    store.toggleLeader('student-1', secondTarget)
    store.moveStudent('student-1', secondTarget, thirdTarget)

    expect(roster.assignments.map((assignment) => assignment.positionId)).toEqual([
      firstPosition.id,
      thirdPosition.id
    ])
    expect(roster.leaders[0]).toMatchObject({
      period: DutyPeriodEnum.Wednesday,
      sectionId: roster.sections[0].id,
      studentId: 'student-1'
    })

    store.removeStudentAssignment('student-1', thirdTarget)
    expect(roster.assignments).toHaveLength(1)
    expect(roster.leaders).toEqual([])
    expect(store.pendingStudentCounts['student-1']).toBe(1)
  })

  it('sets daily leaders independently in each section', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四' }
    ]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const indoorSection = roster.sections[0]
    const cleaningSection = roster.sections[1]
    const indoorTarget = {
      period: DutyPeriodEnum.Monday,
      positionId: indoorSection.positions[0].id
    }
    const cleaningTarget = {
      period: DutyPeriodEnum.Monday,
      positionId: cleaningSection.positions[0].id
    }
    store.assignStudent('student-1', indoorTarget)
    store.assignStudent('student-2', cleaningTarget)
    store.toggleLeader('student-1', indoorTarget)
    store.toggleLeader('student-2', cleaningTarget)

    expect(roster.leaders).toEqual([
      {
        period: DutyPeriodEnum.Monday,
        rowId: undefined,
        sectionId: indoorSection.id,
        studentId: 'student-1'
      },
      {
        period: DutyPeriodEnum.Monday,
        rowId: undefined,
        sectionId: cleaningSection.id,
        studentId: 'student-2'
      }
    ])
  })

  it('sets a top section leader without changing daily leaders', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四' }
    ]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const section = roster.sections[0]
    const target = {
      period: DutyPeriodEnum.Monday,
      positionId: section.positions[0].id
    }
    store.assignStudent('student-1', target)
    store.toggleLeader('student-1', target)

    store.setSectionLeader(section.id, 'student-2')

    expect(section.leaderStudentId).toBe('student-2')
    expect(roster.leaders).toHaveLength(1)
    expect(roster.leaders[0].studentId).toBe('student-1')
  })

  it('returns students to the unassigned list after deleting a position', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const positionId = roster.sections[0].positions[0].id
    store.assignStudent('student-1', { period: DutyPeriodEnum.Monday, positionId })
    store.toggleLeader('student-1', { period: DutyPeriodEnum.Monday, positionId })

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

  it('does not rewrite existing leaders when reconciling students', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useDutyRosterStore()
    const roster = store.createRoster({ studentSource: 'system' })
    const leader = {
      period: DutyPeriodEnum.Monday,
      sectionId: roster.sections[0].id,
      studentId: 'student-1'
    }
    roster.leaders = [leader]

    store.reconcileStudents()

    expect(store.editingRoster?.leaders).toEqual([leader])
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
    store.removeWeeklyRow(secondRowId!)

    expect(roster.weeklyRows).toHaveLength(1)
    expect(store.assignedCount).toBe(0)
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
