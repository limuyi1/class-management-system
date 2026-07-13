import { describe, expect, it } from 'vitest'

import { PagesEnum } from '@/types/Common'
import { SeatingViewDirectionEnum, type SeatingChartType } from '@/types/SeatingChart'
import { buildSeatingChartPdfLayout } from '@/utils/seatingChartPdfLayoutUntil'
import { createSeats, createSpecialSeats } from '@/utils/seatingChartUntil'

function createChart(rows: number, columns: number): SeatingChartType {
  return {
    id: 'chart',
    name: '测试座位表',
    rows,
    columns,
    aisleAfterColumns: columns > 2 ? [1] : [],
    viewDirection: SeatingViewDirectionEnum.FacingPlatform,
    seats: createSeats(rows, columns),
    specialSeats: createSpecialSeats(),
    createdAt: '',
    updatedAt: ''
  }
}

describe('seatingChartPdfLayoutUntil', () => {
  it('keeps a regular chart inside an A4 landscape page', () => {
    const layout = buildSeatingChartPdfLayout(createChart(9, 6), PagesEnum.A4)

    expect(layout.pageWidth).toBeGreaterThan(layout.pageHeight)
    expect(layout.gridLeft).toBeGreaterThanOrEqual(layout.margin)
    expect(layout.gridLeft + layout.gridWidth).toBeLessThanOrEqual(layout.pageWidth - layout.margin)
    expect(layout.gridTop + layout.gridHeight).toBeLessThan(layout.pageHeight - layout.margin)
  })

  it('scales a maximum-size chart to one page and gives A3 more room', () => {
    const chart = createChart(20, 20)
    chart.aisleAfterColumns = [4, 9, 14]
    const a4 = buildSeatingChartPdfLayout(chart, PagesEnum.A4)
    const a3 = buildSeatingChartPdfLayout(chart, PagesEnum.A3)

    expect(a4.gridLeft).toBeGreaterThanOrEqual(a4.margin)
    expect(a4.gridTop + a4.gridHeight).toBeLessThan(a4.pageHeight - a4.margin)
    expect(a3.seatWidth).toBeGreaterThan(a4.seatWidth)
    expect(a3.seatHeight).toBeGreaterThan(a4.seatHeight)
  })

  it('moves the platform below the grid for the teacher-facing view', () => {
    const chart = createChart(6, 6)
    chart.viewDirection = SeatingViewDirectionEnum.FacingStudents
    const layout = buildSeatingChartPdfLayout(chart, PagesEnum.A4)

    expect(layout.platformTop).toBeGreaterThan(layout.gridTop + layout.gridHeight)
  })
})
