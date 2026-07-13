import {
  SeatingSpecialSeatPositionEnum,
  SeatingViewDirectionEnum,
  type SeatPositionType,
  type SeatingChartType,
  type SeatingSpecialSeatType
} from '@/types/SeatingChart'

export const SEATING_CHART_MIN_SIZE = 1
export const SEATING_CHART_MAX_SIZE = 20

export function createSpecialSeats(): SeatingSpecialSeatType[] {
  return [
    { position: SeatingSpecialSeatPositionEnum.PlatformLeft, enabled: false, studentId: null },
    { position: SeatingSpecialSeatPositionEnum.PlatformRight, enabled: false, studentId: null }
  ]
}

export function createSeats(rows: number, columns: number): SeatPositionType[] {
  return Array.from({ length: rows * columns }, (_, index) => ({
    row: Math.floor(index / columns),
    column: index % columns,
    studentId: null
  }))
}

export function getSeatKey(row: number, column: number): string {
  return `${row}-${column}`
}

export function resizeSeats(chart: SeatingChartType, rows: number, columns: number): SeatPositionType[] {
  const existing = new Map(chart.seats.map((seat) => [getSeatKey(seat.row, seat.column), seat.studentId]))
  return createSeats(rows, columns).map((seat) => ({
    ...seat,
    studentId: existing.get(getSeatKey(seat.row, seat.column)) || null
  }))
}

export function getResizeAffectedCount(chart: SeatingChartType, rows: number, columns: number): number {
  return chart.seats.filter((seat) => seat.studentId && (seat.row >= rows || seat.column >= columns)).length
}

export function normalizeChart(chart: SeatingChartType, studentIds: Set<string>): SeatingChartType {
  const rows = Math.min(SEATING_CHART_MAX_SIZE, Math.max(SEATING_CHART_MIN_SIZE, Math.floor(chart.rows)))
  const columns = Math.min(SEATING_CHART_MAX_SIZE, Math.max(SEATING_CHART_MIN_SIZE, Math.floor(chart.columns)))
  const seen = new Set<string>()
  const stored = new Map(chart.seats.map((seat) => [getSeatKey(seat.row, seat.column), seat.studentId]))
  const seats = createSeats(rows, columns).map((seat) => {
    const studentId = stored.get(getSeatKey(seat.row, seat.column))
    if (!studentId || !studentIds.has(studentId) || seen.has(studentId)) return seat
    seen.add(studentId)
    return { ...seat, studentId }
  })
  const storedSpecialSeats = Array.isArray(chart.specialSeats) ? chart.specialSeats : []
  const specialSeats = createSpecialSeats().map((defaultSeat) => {
    const storedSeat = storedSpecialSeats.find((seat) => seat.position === defaultSeat.position)
    const studentId = storedSeat?.studentId
    if (!storedSeat?.enabled || !studentId || !studentIds.has(studentId) || seen.has(studentId)) {
      return { ...defaultSeat, enabled: storedSeat?.enabled === true }
    }
    seen.add(studentId)
    return { ...defaultSeat, enabled: true, studentId }
  })
  return {
    ...chart,
    rows,
    columns,
    seats,
    specialSeats,
    aisleAfterColumns: [...new Set(chart.aisleAfterColumns)]
      .filter((column) => Number.isInteger(column) && column >= 0 && column < columns - 1)
      .sort((a, b) => a - b)
  }
}

export function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[next]] = [result[next], result[index]]
  }
  return result
}

export function createRandomSeats(chart: SeatingChartType, studentIds: string[], supplement = false) {
  const seats = supplement ? chart.seats.map((seat) => ({ ...seat })) : createSeats(chart.rows, chart.columns)
  const assigned = new Set([
    ...seats.map((seat) => seat.studentId).filter(Boolean),
    ...chart.specialSeats.map((seat) => seat.studentId).filter(Boolean)
  ] as string[])
  const candidates = studentIds.filter((id) => !assigned.has(id))
  const emptySeats = seats.filter((seat) => !seat.studentId)
  const shuffledCandidates = shuffled(candidates)
  const randomizedStudentIds = shuffledCandidates.slice(0, emptySeats.length)
  const unassignedStudentIds = shuffledCandidates.slice(emptySeats.length)
  shuffled(emptySeats).forEach((seat, index) => {
    seat.studentId = randomizedStudentIds[index] || null
  })
  return {
    seats,
    randomizedStudentIds,
    unassignedCount: unassignedStudentIds.length,
    unassignedStudentIds
  }
}

export function getVisibleSeats(chart: SeatingChartType): SeatPositionType[] {
  const seats = [...chart.seats]
  if (chart.viewDirection === SeatingViewDirectionEnum.FacingStudents) {
    return seats.sort((a, b) => b.row - a.row || b.column - a.column)
  }
  return seats.sort((a, b) => a.row - b.row || a.column - b.column)
}
