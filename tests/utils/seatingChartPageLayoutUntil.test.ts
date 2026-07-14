import { describe, expect, it } from 'vitest'

import { PagesEnum } from '@/types/Common'
import { SeatingViewDirectionEnum, type SeatingChartType } from '@/types/SeatingChart'
import {
  buildSeatingChartPageLayout,
  resolveSeatingChartPageOrientation
} from '@/utils/seatingChartPageLayoutUntil'
import { createSeats, createSpecialSeats } from '@/utils/seatingChartUntil'

function createChart(rows: number, columns: number): SeatingChartType {
  return {
    id: 'chart',
    name: '测试座位表',
    studentSource: 'system',
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

describe('seatingChartPageLayoutUntil', () => {
  it('returns the selected paper dimensions and gives A3 more room', () => {
    const chart = createChart(20, 20)
    const a4 = buildSeatingChartPageLayout(chart, PagesEnum.A4, 'landscape')
    const a3 = buildSeatingChartPageLayout(chart, PagesEnum.A3, 'landscape')

    expect(a4.pageWidth).toBeGreaterThan(a4.pageHeight)
    expect(a3.fontScale).toBeGreaterThan(a4.fontScale)
  })

  it('recommends the direction that gives the content a larger fit scale', () => {
    expect(resolveSeatingChartPageOrientation(createChart(12, 3), PagesEnum.A4)).toBe('portrait')
    expect(resolveSeatingChartPageOrientation(createChart(3, 12), PagesEnum.A4)).toBe('landscape')
  })

  it('applies the selected scale ratio and caps it at 150 percent', () => {
    const chart = createChart(8, 7)
    const automatic = buildSeatingChartPageLayout(chart, PagesEnum.A4, 'landscape')
    const reduced = buildSeatingChartPageLayout(chart, PagesEnum.A4, 'landscape', 0.9)
    const oversized = buildSeatingChartPageLayout(chart, PagesEnum.A4, 'landscape', 2)

    expect(reduced.fontScale).toBeCloseTo(automatic.fontScale * 0.9)
    expect(oversized.fontScale).toBeCloseTo(automatic.fontScale * 1.5)
  })

  it('reclaims the title area when the title is hidden', () => {
    const chart = createChart(8, 7)
    const titled = buildSeatingChartPageLayout(chart, PagesEnum.A4, 'landscape', 1, true)
    const untitled = buildSeatingChartPageLayout(chart, PagesEnum.A4, 'landscape', 1, false)

    expect(untitled.fontScale).toBeGreaterThan(titled.fontScale)
  })
})
