import { SeatingFirstColumnSideEnum } from '@/types/SeatingChart'

import type { SeatPositionType, SeatingChartType } from '@/types/SeatingChart'

/** 前后按与讲台的距离解释，左右按当前画布显示方向解释。 */
export enum SeatingRotationDirectionEnum {
  Forward = 'forward',
  Backward = 'backward',
  Left = 'left',
  Right = 'right'
}

/** 在同列/同排的有效座位内循环，固定学生、空位和雅座原样保留。 */
export function rotateSeatingChart(
  chart: SeatingChartType,
  direction: SeatingRotationDirectionEnum,
  steps: number,
  fixedStudentIds: string[]
): SeatPositionType[] {
  const occupied = [...chart.seats, ...chart.specialSeats].flatMap((seat) =>
    seat.studentId ? [seat.studentId] : []
  )
  if (new Set(occupied).size !== occupied.length)
    throw new Error('当前方案有重复学生，请先校对座位')
  const seats = chart.seats.map((seat) => ({ ...seat }))
  const fixed = new Set(fixedStudentIds)
  const vertical =
    direction === SeatingRotationDirectionEnum.Forward ||
    direction === SeatingRotationDirectionEnum.Backward
  const groups = new Map<number, SeatPositionType[]>()
  for (const seat of seats) {
    if (!seat.studentId || fixed.has(seat.studentId)) continue
    const key = vertical ? seat.column : seat.row
    groups.set(key, [...(groups.get(key) || []), seat])
  }
  let sign =
    direction === SeatingRotationDirectionEnum.Forward ||
    direction === SeatingRotationDirectionEnum.Left
      ? -1
      : 1
  // 第 0 行始终靠近讲台；首列位于右侧时，屏幕左右与列号方向相反。
  if (!vertical && chart.firstColumnSide === SeatingFirstColumnSideEnum.Right) sign *= -1
  const offset = Math.max(1, Math.floor(Number.isFinite(steps) ? steps : 1)) * sign
  for (const group of groups.values()) {
    group.sort((a, b) => (vertical ? a.row - b.row : a.column - b.column))
    const ids = group.map((seat) => seat.studentId)
    group.forEach((seat, index) => {
      seat.studentId = ids[(((index - offset) % group.length) + group.length) % group.length]
    })
  }
  return seats
}
