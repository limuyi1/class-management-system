import { describe, expect, it } from 'vitest'

import { PagesEnum } from '@/types/Common'
import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { buildDutyRosterPageLayout } from '@/utils/dutyRosterPageLayoutUtil'
import { createDefaultDutySections } from '@/utils/dutyRosterUtil'

function createRoster(): DutyRosterType {
  return {
    id: 'roster-1',
    name: '班级值日安排',
    mode: DutyRosterModeEnum.Daily,
    studentSource: 'system',
    sections: createDefaultDutySections(),
    weeklyRows: [{ id: 'weekly-row-1', sortOrder: 0 }],
    assignments: [],
    leaders: [],
    notes: '红色圆点表示组长\n组长负责检查卫生',
    createdAt: '',
    updatedAt: ''
  }
}

describe('dutyRosterPageLayoutUtil', () => {
  it('uses a landscape paper and counts daily rows and positions', () => {
    const layout = buildDutyRosterPageLayout(createRoster(), PagesEnum.A4)

    expect(layout.pageWidth).toBe(841.89)
    expect(layout.pageHeight).toBe(595.28)
    expect(layout.rowCount).toBe(5)
    expect(layout.positionCount).toBe(9)
  })

  it('uses custom weekly rows and reports a smaller scale for denser content', () => {
    const regular = createRoster()
    regular.mode = DutyRosterModeEnum.Weekly
    regular.weeklyRows = [{ id: 'row-1', sortOrder: 0 }]
    const dense = createRoster()
    dense.mode = DutyRosterModeEnum.Weekly
    dense.weeklyRows = Array.from({ length: 8 }, (_, index) => ({
      id: `row-${index}`,
      sortOrder: index
    }))

    const regularLayout = buildDutyRosterPageLayout(regular, PagesEnum.A4)
    const denseLayout = buildDutyRosterPageLayout(dense, PagesEnum.A4)

    expect(denseLayout.rowCount).toBe(8)
    expect(denseLayout.fitScale).toBeLessThan(regularLayout.fitScale)
  })

  it('increases the readability estimate on A3 paper', () => {
    const roster = createRoster()

    expect(buildDutyRosterPageLayout(roster, PagesEnum.A3).fontScale).toBeGreaterThan(
      buildDutyRosterPageLayout(roster, PagesEnum.A4).fontScale
    )
  })
})
