import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { SeatingFirstColumnSideEnum, type SeatingChartType } from '@/types/SeatingChart'

describe('useSeatingChartStore', () => {
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
})
