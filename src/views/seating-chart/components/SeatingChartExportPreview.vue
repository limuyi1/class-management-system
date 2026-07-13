<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import {
  SeatingSpecialSeatPositionEnum,
  SeatingViewDirectionEnum,
  type SeatPositionType,
  type SeatingChartType
} from '@/types/SeatingChart'
import { getSeatKey, getVisibleSeats } from '@/utils/seatingChartUntil'

const props = defineProps<{
  chart: SeatingChartType
  studentNames: Record<string, string>
  showEmptyLabels: boolean
}>()

const exportElementRef = shallowRef<HTMLElement | null>(null)
const facingStudents = computed(
  () => props.chart.viewDirection === SeatingViewDirectionEnum.FacingStudents
)
const visibleSeatRows = computed(() => {
  const rows: SeatPositionType[][] = []
  getVisibleSeats(props.chart).forEach((seat) => {
    const currentRow = rows[rows.length - 1]
    if (!currentRow || currentRow[0].row !== seat.row) rows.push([seat])
    else currentRow.push(seat)
  })
  return rows
})
const visibleColumnSeats = computed(() => visibleSeatRows.value[0] || [])
const enabledSpecialSeats = computed(() => props.chart.specialSeats.filter((seat) => seat.enabled))

function hasAisleAfterSeat(seat: SeatPositionType): boolean {
  const aisleColumn = facingStudents.value ? seat.column - 1 : seat.column
  return props.chart.aisleAfterColumns.includes(aisleColumn)
}

function getSpecialSeatName(position: SeatingSpecialSeatPositionEnum): string {
  const seat = props.chart.specialSeats.find((item) => item.position === position)
  return seat?.studentId ? props.studentNames[seat.studentId] || '未命名学生' : ''
}

function getElement(): HTMLElement | null {
  return exportElementRef.value
}

defineExpose({ getElement })
</script>

<template>
  <article ref="exportElementRef" class="seating-export-sheet">
    <header class="sheet-header">
      <h2>{{ chart.name }}</h2>
    </header>

    <div class="classroom-plan" :class="{ 'facing-students': facingStudents }">
      <div class="platform-area">
        <div class="special-seat-slot special-seat-slot--left">
          <div
            v-if="
              chart.specialSeats.find(
                (seat) => seat.position === SeatingSpecialSeatPositionEnum.PlatformLeft
              )?.enabled
            "
            class="export-special-seat"
          >
            <small>讲台左侧</small>
            <strong>{{
              getSpecialSeatName(SeatingSpecialSeatPositionEnum.PlatformLeft) ||
              (showEmptyLabels ? '空座位' : '')
            }}</strong>
          </div>
        </div>
        <div class="export-platform">
          <span>讲 台</span>
          <small>PLATFORM</small>
        </div>
        <div class="special-seat-slot special-seat-slot--right">
          <div
            v-if="
              chart.specialSeats.find(
                (seat) => seat.position === SeatingSpecialSeatPositionEnum.PlatformRight
              )?.enabled
            "
            class="export-special-seat"
          >
            <small>讲台右侧</small>
            <strong>{{
              getSpecialSeatName(SeatingSpecialSeatPositionEnum.PlatformRight) ||
              (showEmptyLabels ? '空座位' : '')
            }}</strong>
          </div>
        </div>
      </div>

      <div class="seat-layout">
        <div class="column-headers">
          <span class="axis-corner"></span>
          <template v-for="seat in visibleColumnSeats" :key="`export-column-${seat.column}`">
            <span class="column-header">{{ seat.column + 1 }}<small>列</small></span>
            <span v-if="hasAisleAfterSeat(seat)" class="aisle aisle--header"></span>
          </template>
        </div>

        <div class="seat-rows">
          <div v-for="row in visibleSeatRows" :key="row[0].row" class="seat-row">
            <span class="row-header">{{ row[0].row + 1 }}<small>排</small></span>
            <template v-for="seat in row" :key="getSeatKey(seat.row, seat.column)">
              <div class="export-seat" :class="{ occupied: seat.studentId }">
                <strong v-if="seat.studentId">
                  {{ studentNames[seat.studentId] || '未命名学生' }}
                </strong>
                <span v-else-if="showEmptyLabels">空座位</span>
              </div>
              <span v-if="hasAisleAfterSeat(seat)" class="aisle"></span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <footer class="sheet-footer">
      <span>共 {{ chart.seats.length + enabledSpecialSeats.length }} 个座位</span>
      <span>过道 {{ chart.aisleAfterColumns.length }} 处</span>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.seating-export-sheet {
  --ink: #29232e;
  --muted: #7a7180;
  --line: #d9d1dc;
  --paper: #fffefa;
  --accent: #5d3f7d;
  box-sizing: border-box;
  width: max-content;
  min-width: 760px;
  padding: 34px 38px 26px;
  color: var(--ink);
  background:
    linear-gradient(rgba(117, 91, 75, 0.035) 1px, transparent 1px) 0 0/100% 28px,
    var(--paper);
  border: 1px solid #e7dfd5;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.sheet-header,
.sheet-footer,
.platform-area,
.column-headers,
.seat-row {
  display: flex;
  align-items: center;
}

.sheet-header {
  justify-content: center;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--ink);
  text-align: center;
}

.sheet-header h2 {
  margin: 0;
  font-family: STKaiti, KaiTi, serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}

.classroom-plan {
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 28px 4px 24px;
}

.classroom-plan.facing-students {
  flex-direction: column-reverse;
}

.platform-area {
  justify-content: center;
  gap: 12px;
}

.classroom-plan.facing-students .platform-area {
  flex-direction: row-reverse;
}

.special-seat-slot {
  width: 96px;
  min-width: 96px;
}

.export-platform {
  display: grid;
  width: 300px;
  height: 54px;
  box-sizing: border-box;
  place-content: center;
  color: #fff;
  background: var(--ink);
  border-radius: 4px;
  text-align: center;
}

.export-platform span {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
}

.export-platform small {
  margin-top: 2px;
  color: #d8cfdd;
  font-family: Georgia, serif;
  font-size: 7px;
  letter-spacing: 0.2em;
}

.export-special-seat {
  display: grid;
  width: 96px;
  min-height: 54px;
  box-sizing: border-box;
  place-content: center;
  padding: 7px;
  background: #fff9e9;
  border: 1px solid #cdbb88;
  border-radius: 4px;
  text-align: center;
}

.export-special-seat small {
  color: #927b4f;
  font-size: 8px;
}

.export-special-seat strong {
  margin-top: 3px;
  font-size: 12px;
}

.seat-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: max-content;
  margin: 0 auto;
}

.column-headers,
.seat-row {
  align-items: stretch;
  gap: 8px;
}

.axis-corner,
.row-header {
  width: 34px;
  min-width: 34px;
  box-sizing: border-box;
}

.column-header,
.row-header {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  color: #fff;
  background: var(--accent);
  border-radius: 3px;
  font-family: Georgia, serif;
  font-size: 14px;
  font-weight: 700;
}

.column-header {
  width: 88px;
  min-width: 88px;
  height: 28px;
}

.row-header {
  align-items: center;
  height: 52px;
}

.column-header small,
.row-header small {
  font-family: 'PingFang SC', sans-serif;
  font-size: 8px;
  font-weight: 500;
  opacity: 0.85;
}

.seat-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-seat {
  display: grid;
  width: 88px;
  min-width: 88px;
  height: 52px;
  box-sizing: border-box;
  place-content: center;
  padding: 6px;
  color: #aaa2aa;
  background: rgba(255, 255, 255, 0.82);
  border: 1px dashed var(--line);
  border-radius: 4px;
  font-size: 10px;
  text-align: center;
}

.export-seat.occupied {
  color: var(--ink);
  background: #fff;
  border: 1.5px solid #8c7b92;
}

.export-seat strong {
  max-width: 76px;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.25;
}

.aisle {
  width: 30px;
  min-width: 30px;
  box-sizing: border-box;
  background: repeating-linear-gradient(
    -45deg,
    rgba(93, 63, 125, 0.1) 0 5px,
    rgba(93, 63, 125, 0.025) 5px 10px
  );
  border-inline: 1px solid rgba(93, 63, 125, 0.16);
}

.aisle--header {
  background: transparent;
  border: 0;
}

.sheet-footer {
  justify-content: space-between;
  padding-top: 12px;
  color: var(--muted);
  border-top: 1px solid var(--line);
  font-size: 9px;
  letter-spacing: 0.06em;
}
</style>
