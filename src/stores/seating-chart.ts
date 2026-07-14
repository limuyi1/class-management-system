import { defineStore } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import {
  SeatingViewDirectionEnum,
  type SeatingChartStateType,
  type SeatingChartType,
  type SeatPositionType
} from '@/types/SeatingChart'
import {
  createRandomSeats,
  createSeats,
  createSpecialSeats,
  normalizeChart,
  resizeSeats
} from '@/utils/seatingChartUntil'
import { resolveSeatingChartStudents } from '@/utils/seatingChartStudentUntil'

import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

interface CreateSeatingChartOptionsType {
  name?: string
  rows?: number
  columns?: number
  studentSource: StudentSourceType
  excelSource?: ExcelStudentSourceType
}

const now = (): string => new Date().toISOString()
const createId = (): string => crypto.randomUUID()

const clearChartAssignments = (chart: SeatingChartType): void => {
  chart.seats.forEach((seat) => {
    seat.studentId = null
  })
  chart.specialSeats.forEach((seat) => {
    seat.studentId = null
  })
}

export const useSeatingChartStore = defineStore('seatingChart', {
  state: (): SeatingChartStateType => ({
    charts: [],
    editingChartId: null,
    isSidebarCollapsed: false
  }),
  getters: {
    editingChart: (state): SeatingChartType | null =>
      state.charts.find((chart) => chart.id === state.editingChartId) || null,
    activeStudents(): ReturnType<typeof resolveSeatingChartStudents> {
      return resolveSeatingChartStudents(this.editingChart, useDataSourceStore().enabledData)
    },
    assignedStudentIds(): string[] {
      if (!this.editingChart) return []
      return [...this.editingChart.seats, ...this.editingChart.specialSeats].flatMap((seat) =>
        seat.studentId ? [seat.studentId] : []
      )
    },
    unassignedStudents(): ReturnType<typeof resolveSeatingChartStudents> {
      const assignedIds = new Set(this.assignedStudentIds)
      return this.activeStudents.filter((student) => !assignedIds.has(student.id))
    },
    seatCapacity(): number {
      if (!this.editingChart) return 0
      return (
        this.editingChart.seats.length +
        this.editingChart.specialSeats.filter((seat) => seat.enabled).length
      )
    },
    assignedCount(): number {
      return this.assignedStudentIds.length
    },
    isEmptyChart(): boolean {
      return this.assignedCount === 0
    }
  },
  actions: {
    createChart(options: CreateSeatingChartOptionsType): SeatingChartType {
      const timestamp = now()
      const rows = options.rows ?? 6
      const columns = options.columns ?? 6
      const chart: SeatingChartType = {
        id: createId(),
        name: options.name?.trim() || `座位表 ${this.charts.length + 1}`,
        studentSource: options.studentSource,
        excelSource:
          options.studentSource === 'excel' && options.excelSource
            ? {
                fileName: options.excelSource.fileName,
                students: options.excelSource.students.map((student) => ({ ...student }))
              }
            : undefined,
        rows,
        columns,
        aisleAfterColumns: [],
        viewDirection: SeatingViewDirectionEnum.FacingPlatform,
        seats: createSeats(rows, columns),
        specialSeats: createSpecialSeats(),
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.charts.push(chart)
      this.editingChartId = chart.id
      return chart
    },
    copyChart(chartId: string): void {
      const chart = this.charts.find((item) => item.id === chartId)
      if (!chart) return
      const timestamp = now()
      const copy: SeatingChartType = {
        ...chart,
        id: createId(),
        name: `${chart.name} 副本`,
        excelSource: chart.excelSource
          ? {
              fileName: chart.excelSource.fileName,
              students: chart.excelSource.students.map((student) => ({ ...student }))
            }
          : undefined,
        seats: chart.seats.map((seat) => ({ ...seat })),
        specialSeats: chart.specialSeats.map((seat) => ({ ...seat })),
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.charts.push(copy)
      this.editingChartId = copy.id
    },
    renameChart(chartId: string, name: string): void {
      const chart = this.charts.find((item) => item.id === chartId)
      if (!chart || !name.trim()) return
      chart.name = name.trim()
      chart.updatedAt = now()
    },
    deleteChart(chartId: string): void {
      const index = this.charts.findIndex((chart) => chart.id === chartId)
      if (index < 0) return
      this.charts.splice(index, 1)
      if (this.editingChartId === chartId) this.editingChartId = this.charts[0]?.id || null
    },
    setEditingChart(chartId: string): void {
      if (this.charts.some((chart) => chart.id === chartId)) this.editingChartId = chartId
    },
    setSidebarCollapsed(value: boolean): void {
      this.isSidebarCollapsed = value
    },
    setStudentSource(source: StudentSourceType, excelSource?: ExcelStudentSourceType): void {
      const chart = this.editingChart
      if (!chart) return
      chart.studentSource = source
      if (excelSource) {
        chart.excelSource = {
          fileName: excelSource.fileName,
          students: excelSource.students.map((student) => ({ ...student }))
        }
      }
      clearChartAssignments(chart)
      chart.updatedAt = now()
    },
    setViewDirection(direction: SeatingViewDirectionEnum): void {
      if (!this.editingChart) return
      this.editingChart.viewDirection = direction
      this.editingChart.updatedAt = now()
    },
    resizeChart(rows: number, columns: number): void {
      if (!this.editingChart) return
      this.editingChart.seats = resizeSeats(this.editingChart, rows, columns)
      this.editingChart.rows = rows
      this.editingChart.columns = columns
      this.editingChart.aisleAfterColumns = this.editingChart.aisleAfterColumns.filter(
        (item) => item < columns - 1
      )
      this.editingChart.updatedAt = now()
    },
    setAisles(aisles: number[]): void {
      if (!this.editingChart) return
      this.editingChart.aisleAfterColumns = [...new Set(aisles)]
        .filter((item) => item >= 0 && item < this.editingChart!.columns - 1)
        .sort((a, b) => a - b)
      this.editingChart.updatedAt = now()
    },
    setSpecialSeatEnabled(
      position: SeatingChartType['specialSeats'][number]['position'],
      enabled: boolean
    ): void {
      const chart = this.editingChart
      const seat = chart?.specialSeats.find((item) => item.position === position)
      if (!chart || !seat) return
      seat.enabled = enabled
      if (!enabled) seat.studentId = null
      chart.updatedAt = now()
    },
    assignStudent(studentId: string, row: number, column: number): void {
      const chart = this.editingChart
      if (!chart) return
      const target = chart.seats.find((seat) => seat.row === row && seat.column === column)
      if (!target) return
      const source = [...chart.seats, ...chart.specialSeats].find(
        (seat) => seat.studentId === studentId
      )
      if (source) source.studentId = target.studentId
      target.studentId = studentId
      chart.updatedAt = now()
    },
    assignStudentToSpecial(
      studentId: string,
      position: SeatingChartType['specialSeats'][number]['position']
    ): void {
      const chart = this.editingChart
      if (!chart) return
      const target = chart.specialSeats.find((seat) => seat.position === position && seat.enabled)
      if (!target) return
      const source = [...chart.seats, ...chart.specialSeats].find(
        (seat) => seat.studentId === studentId
      )
      if (source) source.studentId = target.studentId
      target.studentId = studentId
      chart.updatedAt = now()
    },
    unassignStudent(studentId: string): void {
      const chart = this.editingChart
      const seat = chart
        ? [...chart.seats, ...chart.specialSeats].find((item) => item.studentId === studentId)
        : null
      if (!chart || !seat) return
      seat.studentId = null
      chart.updatedAt = now()
    },
    randomizeAll(): number {
      const chart = this.editingChart
      if (!chart) return 0
      const result = createRandomSeats(
        chart,
        this.activeStudents.map((student) => student.id)
      )
      chart.seats = result.seats
      chart.updatedAt = now()
      return result.unassignedCount
    },
    applySupplementPreview(seats: SeatPositionType[]): void {
      if (!this.editingChart) return
      this.editingChart.seats = seats.map((seat) => ({ ...seat }))
      this.editingChart.updatedAt = now()
    },
    reconcileStudents(): void {
      const systemStudents = useDataSourceStore().enabledData
      this.charts = this.charts.map((chart) => {
        const students = resolveSeatingChartStudents(chart, systemStudents)
        return normalizeChart(chart, new Set(students.map((student) => student.id)))
      })
      if (!this.charts.some((chart) => chart.id === this.editingChartId)) {
        this.editingChartId = this.charts[0]?.id || null
      }
    }
  }
})
