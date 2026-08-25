/**
 * dutyRosterPageLayoutUtil 测试
 * 覆盖值日表页面布局计算（buildDutyRosterPageLayout），
 * 包括横向纸张尺寸、行列数与岗位数统计、内容密度自适应缩放及不同纸张下的可读性。
 */

import { describe, expect, it } from 'vitest'

import { PagesEnum } from '@/types/Common'
import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { buildDutyRosterPageLayout } from '@/utils/duty-roster/dutyRosterPageLayoutUtil'
import { createDefaultDutySections } from '@/utils/duty-roster/dutyRosterUtil'

// 构造最小完整值日表数据，供各用例复用
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

// 值日表页面布局：验证纸张方向、行列数与岗位数、缩放比例推导
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
