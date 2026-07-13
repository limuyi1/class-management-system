import { defineStore } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { SeatingSpecialSeatPositionEnum, SeatingViewDirectionEnum, type SeatingChartStateType, type SeatingChartType, type SeatPositionType } from '@/types/SeatingChart'
import { createRandomSeats, createSeats, createSpecialSeats, normalizeChart, resizeSeats } from '@/utils/seatingChartUntil'

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()

export const useSeatingChartStore = defineStore('seatingChart', {
  state: (): SeatingChartStateType => ({ charts: [], editingChartId: null, isSidebarCollapsed: false, initializationVersion: 0 }),
  getters: {
    editingChart: (state): SeatingChartType | null => state.charts.find((chart) => chart.id === state.editingChartId) || null,
    assignedStudentIds(): string[] { if (!this.editingChart) return []; return [...this.editingChart.seats, ...(this.editingChart.specialSeats || [])].flatMap((seat) => (seat.studentId ? [seat.studentId] : [])) },
    unassignedStudents(): ReturnType<typeof useDataSourceStore>['enabledData'] { const ids = new Set(this.assignedStudentIds); return useDataSourceStore().enabledData.filter((student) => !ids.has(student.studentId)) },
    seatCapacity(): number { if (!this.editingChart) return 0; return this.editingChart.seats.length + (this.editingChart.specialSeats || []).filter((seat) => seat.enabled).length },
    assignedCount(): number { return this.assignedStudentIds.length },
    isEmptyChart(): boolean { return this.assignedCount === 0 }
  },
  actions: {
    createChart(name?: string, rows = 6, columns = 6): SeatingChartType {
      const timestamp = now(); const chart: SeatingChartType = { id: id(), name: name?.trim() || `座位表 ${this.charts.length + 1}`, rows, columns, aisleAfterColumns: [], viewDirection: SeatingViewDirectionEnum.FacingPlatform, seats: createSeats(rows, columns), specialSeats: createSpecialSeats(), createdAt: timestamp, updatedAt: timestamp }
      this.charts.push(chart); this.editingChartId = chart.id; this.initializationVersion = 2; return chart
    },
    copyChart(chartId: string): void { const chart = this.charts.find((item) => item.id === chartId); if (!chart) return; const timestamp = now(); const copy = { ...chart, id: id(), name: `${chart.name} 副本`, seats: chart.seats.map((seat) => ({ ...seat })), specialSeats: chart.specialSeats.map((seat) => ({ ...seat })), createdAt: timestamp, updatedAt: timestamp }; this.charts.push(copy); this.editingChartId = copy.id },
    renameChart(chartId: string, name: string): void { const chart = this.charts.find((item) => item.id === chartId); if (chart && name.trim()) { chart.name = name.trim(); chart.updatedAt = now() } },
    deleteChart(chartId: string): void { const index = this.charts.findIndex((chart) => chart.id === chartId); if (index < 0) return; this.charts.splice(index, 1); if (this.editingChartId === chartId) this.editingChartId = this.charts[0]?.id || null },
    setEditingChart(chartId: string): void { if (this.charts.some((chart) => chart.id === chartId)) this.editingChartId = chartId },
    setSidebarCollapsed(value: boolean): void { this.isSidebarCollapsed = value },
    setViewDirection(direction: SeatingViewDirectionEnum): void { if (this.editingChart) { this.editingChart.viewDirection = direction; this.editingChart.updatedAt = now() } },
    resizeChart(rows: number, columns: number): void { if (this.editingChart) { this.editingChart.seats = resizeSeats(this.editingChart, rows, columns); this.editingChart.rows = rows; this.editingChart.columns = columns; this.editingChart.aisleAfterColumns = this.editingChart.aisleAfterColumns.filter((item) => item < columns - 1); this.editingChart.updatedAt = now() } },
    setAisles(aisles: number[]): void { if (this.editingChart) { this.editingChart.aisleAfterColumns = [...new Set(aisles)].filter((item) => item >= 0 && item < this.editingChart!.columns - 1).sort((a, b) => a - b); this.editingChart.updatedAt = now() } },
    setSpecialSeatEnabled(position: SeatingSpecialSeatPositionEnum, enabled: boolean): void { const chart = this.editingChart; const seat = chart?.specialSeats.find((item) => item.position === position); if (!chart || !seat) return; seat.enabled = enabled; if (!enabled) seat.studentId = null; chart.updatedAt = now() },
    assignStudent(studentId: string, row: number, column: number): void { const chart = this.editingChart; if (!chart) return; const target = chart.seats.find((seat) => seat.row === row && seat.column === column); if (!target) return; const source = [...chart.seats, ...chart.specialSeats].find((seat) => seat.studentId === studentId); if (source) source.studentId = target.studentId; target.studentId = studentId; chart.updatedAt = now() },
    assignStudentToSpecial(studentId: string, position: SeatingSpecialSeatPositionEnum): void { const chart = this.editingChart; if (!chart) return; const target = chart.specialSeats.find((seat) => seat.position === position && seat.enabled); if (!target) return; const source = [...chart.seats, ...chart.specialSeats].find((seat) => seat.studentId === studentId); if (source) source.studentId = target.studentId; target.studentId = studentId; chart.updatedAt = now() },
    unassignStudent(studentId: string): void { const chart = this.editingChart; const seat = chart ? [...chart.seats, ...chart.specialSeats].find((item) => item.studentId === studentId) : null; if (chart && seat) { seat.studentId = null; chart.updatedAt = now() } },
    randomizeAll(): number { const chart = this.editingChart; if (!chart) return 0; const result = createRandomSeats(chart, useDataSourceStore().enabledData.map((student) => student.studentId)); chart.seats = result.seats; chart.updatedAt = now(); return result.unassignedCount },
    applySupplementPreview(seats: SeatPositionType[]): void { if (this.editingChart) { this.editingChart.seats = seats.map((seat) => ({ ...seat })); this.editingChart.updatedAt = now() } },
    reconcileStudents(): void { const ids = new Set(useDataSourceStore().enabledData.map((student) => student.studentId)); this.charts = this.charts.map((chart) => normalizeChart(chart, ids)); if (!this.charts.some((chart) => chart.id === this.editingChartId)) this.editingChartId = this.charts[0]?.id || null }
    ,
    clearLegacyDefaultChart(): void {
      if (this.initializationVersion >= 2) return
      const legacyChart = this.charts[0]
      const isLegacyDefault = this.charts.length === 1 && legacyChart?.name === '座位表 1' && legacyChart.rows === 6 && legacyChart.columns === 6 && legacyChart.aisleAfterColumns.length === 0 && legacyChart.seats.every((seat) => seat.studentId === null)
      if (isLegacyDefault) { this.charts = []; this.editingChartId = null }
      this.initializationVersion = 2
    }
  }
})
