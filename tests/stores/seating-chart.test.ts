import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { SeatingFirstColumnSideEnum, type SeatingChartType } from '@/types/SeatingChart'

/**
 * useSeatingChartStore store 测试
 * 测试目标：座位表 store
 * 覆盖功能：系统/Excel 学生来源、随机排座、来源切换时清空安排、默认来源回退、创建状态与首列方向
 */
describe('useSeatingChartStore', () => {
  // 每个用例前创建全新的 Pinia 实例，隔离 store 状态
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses enabled system students for a system chart', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '李四', disabled: true }
    ]
    const store = useSeatingChartStore()

    store.createChart({ studentSource: 'system', rows: 1, columns: 1 })

    expect(store.activeStudents).toEqual([{ id: 'student-1', name: '张三' }])
    expect(store.unassignedStudents).toHaveLength(1)
  })

  it('persists an Excel roster on the chart and uses it for random seating', () => {
    const store = useSeatingChartStore()
    store.createChart({
      studentSource: 'excel',
      excelSource: {
        fileName: '名单.xlsx',
        students: [
          { id: 'excel:0', name: '张三' },
          { id: 'excel:1', name: '李四' }
        ]
      },
      rows: 1,
      columns: 1
    })

    expect(store.activeStudents).toHaveLength(2)
    expect(store.randomizeAll()).toBe(1)
    expect(store.assignedCount).toBe(1)
    expect(store.editingChart?.excelSource?.fileName).toBe('名单.xlsx')
  })

  it('adds and removes students from only the current Excel roster', () => {
    const store = useSeatingChartStore()
    const chart = store.createChart({
      studentSource: 'excel',
      excelSource: {
        fileName: '名单.xlsx',
        students: [
          { id: 'excel:0', name: '张三' },
          { id: 'excel:1', name: '李四' }
        ]
      },
      rows: 1,
      columns: 2
    })
    store.assignStudent('excel:0', 0, 0)
    store.toggleStudentRole('excel:0', chart.roleDefinitions[0].id)

    const added = store.addExcelStudent(' 王五 ')

    expect(added).toMatchObject({ name: '王五' })
    expect(added?.id).toMatch(/^manual:/)
    expect(store.unassignedStudents.map((student) => student.name)).toEqual(['李四', '王五'])
    expect(chart.seats[0].studentId).toBe('excel:0')
    expect(chart.roleAssignments).toHaveLength(1)

    expect(store.removeExcelStudent('excel:0')).toBe(true)
    expect(chart.excelSource?.students.map((student) => student.name)).toEqual(['李四', '王五'])
    expect(chart.seats[0].studentId).toBeNull()
    expect(chart.roleAssignments).toEqual([])
  })

  it('does not edit the system student source through Excel roster actions', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useSeatingChartStore()
    store.createChart({ studentSource: 'system' })

    expect(store.addExcelStudent('李四')).toBeNull()
    expect(store.removeExcelStudent('student-1')).toBe(false)
    expect(dataStore.students).toEqual([{ studentId: 'student-1', name: '张三' }])
  })

  it('clears assignments when switching sources and keeps the uploaded roster available', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '王五' }]
    const store = useSeatingChartStore()
    store.createChart({
      studentSource: 'excel',
      excelSource: {
        fileName: '名单.xlsx',
        students: [{ id: 'excel:0', name: '张三' }]
      },
      rows: 1,
      columns: 1
    })
    store.assignStudent('excel:0', 0, 0)

    store.setStudentSource('system')

    expect(store.assignedCount).toBe(0)
    expect(store.activeStudents).toEqual([{ id: 'student-1', name: '王五' }])
    expect(store.editingChart?.excelSource?.fileName).toBe('名单.xlsx')
  })

  it('defaults a stored chart without a source to system students when available', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '王五' }]
    const store = useSeatingChartStore()
    const chart = store.createChart({ studentSource: 'system', rows: 1, columns: 1 })
    delete (chart as Partial<SeatingChartType>).studentSource

    store.reconcileStudents()

    expect(store.editingChart?.studentSource).toBe('system')
    expect(store.activeStudents).toEqual([{ id: 'student-1', name: '王五' }])
  })

  it('enters the create state without deleting existing charts', () => {
    const store = useSeatingChartStore()
    const chart = store.createChart({ studentSource: 'system' })

    store.startCreatingChart()

    expect(store.editingChart).toBeNull()
    expect(store.charts).toEqual([chart])
  })

  it('stores which side contains the first column', () => {
    const store = useSeatingChartStore()
    store.createChart({
      studentSource: 'system',
      firstColumnSide: SeatingFirstColumnSideEnum.Right
    })

    expect(store.editingChart?.firstColumnSide).toBe(SeatingFirstColumnSideEnum.Right)

    store.setFirstColumnSide(SeatingFirstColumnSideEnum.Left)

    expect(store.editingChart?.firstColumnSide).toBe(SeatingFirstColumnSideEnum.Left)
  })

  it('supports multiple configurable roles per student and keeps them during reseating', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useSeatingChartStore()
    store.createChart({ studentSource: 'system', rows: 1, columns: 1 })
    const roles = store.editingChart!.roleDefinitions
    const chineseLeader = roles.find((role) => role.subject === '语文' && role.title === '组长')!
    const mathDeputy = roles.find((role) => role.subject === '数学' && role.title === '副组长')!

    store.toggleStudentRole('student-1', chineseLeader.id)
    store.toggleStudentRole('student-1', mathDeputy.id)
    store.randomizeAll()

    expect(store.editingChart?.roleAssignments).toEqual([
      { studentId: 'student-1', roleIds: [chineseLeader.id, mathDeputy.id] }
    ])
    expect(store.editingChart?.seats[0].studentId).toBe('student-1')
  })

  it('clears student role assignments when replacing the student source', () => {
    const dataStore = useDataSourceStore()
    dataStore.students = [{ studentId: 'student-1', name: '张三' }]
    const store = useSeatingChartStore()
    store.createChart({ studentSource: 'system', rows: 1, columns: 1 })
    store.toggleStudentRole('student-1', store.editingChart!.roleDefinitions[0].id)

    store.setStudentSource('excel', {
      fileName: '名单.xlsx',
      students: [{ id: 'excel:0', name: '李四' }]
    })

    expect(store.editingChart?.roleAssignments).toEqual([])
    expect(store.editingChart?.roleDefinitions).toHaveLength(9)
  })
})
