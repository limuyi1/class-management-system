import { describe, expect, it } from 'vitest'

import { SeatingSpecialSeatPositionEnum, SeatingViewDirectionEnum, type SeatingChartType } from '@/types/SeatingChart'
import { createRandomSeats, createSeats, createSpecialSeats, getVisibleSeats, normalizeChart, resizeSeats } from '@/utils/seatingChartUntil'

const chart = (rows = 2, columns = 2): SeatingChartType => ({
  id: 'chart', name: '测试', rows, columns, aisleAfterColumns: [],
  viewDirection: SeatingViewDirectionEnum.FacingPlatform, seats: createSeats(rows, columns),
  specialSeats: createSpecialSeats(),
  createdAt: '', updatedAt: ''
})

describe('seatingChartUntil', () => {
  it('creates stable row-column coordinates and preserves in-bound seats on resize', () => {
    const source = chart()
    source.seats[0].studentId = 'student-1'
    expect(resizeSeats(source, 3, 2)).toHaveLength(6)
    expect(resizeSeats(source, 1, 1)[0].studentId).toBe('student-1')
  })

  it('normalizes invalid bindings and invalid aisle positions', () => {
    const source = chart()
    source.seats[0].studentId = 'valid'
    source.seats[1].studentId = 'valid'
    source.seats[2].studentId = 'removed'
    source.aisleAfterColumns = [0, 0, 1]
    const result = normalizeChart(source, new Set(['valid']))
    expect(result.seats.filter((seat) => seat.studentId === 'valid')).toHaveLength(1)
    expect(result.aisleAfterColumns).toEqual([0])
  })

  it('randomizes only available capacity and flips visual order without changing source coordinates', () => {
    const source = chart(1, 2)
    const random = createRandomSeats(source, ['a', 'b', 'c'])
    expect(random.seats.filter((seat) => seat.studentId)).toHaveLength(2)
    expect(random.unassignedCount).toBe(1)
    expect(random.unassignedStudentIds).toHaveLength(1)
    expect(['a', 'b', 'c']).toContain(random.unassignedStudentIds[0])
    source.viewDirection = SeatingViewDirectionEnum.FacingStudents
    expect(getVisibleSeats(source).map((seat) => seat.column)).toEqual([1, 0])
  })

  it('keeps enabled special-seat students fixed during randomization', () => {
    const source = chart(1, 2)
    const specialSeat = source.specialSeats.find((seat) => seat.position === SeatingSpecialSeatPositionEnum.PlatformLeft)!
    specialSeat.enabled = true
    specialSeat.studentId = 'a'
    const random = createRandomSeats(source, ['a', 'b', 'c'])
    expect(specialSeat.studentId).toBe('a')
    expect(random.randomizedStudentIds).toEqual(expect.arrayContaining(['b', 'c']))
    expect(random.randomizedStudentIds).not.toContain('a')
  })
})
