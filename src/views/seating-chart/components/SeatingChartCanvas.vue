<script setup lang="ts">
/** 座位图画布 — 渲染讲台、雅座与座位网格，并处理座位拖拽/点击交互 */
import { computed, shallowRef } from 'vue'

import { useSeatingChartViewport } from '@/views/seating-chart/composables/useSeatingChartViewport'
import {
  SeatingFirstColumnSideEnum,
  SeatingSpecialSeatPositionEnum,
  type SeatPositionType,
  type SeatingChartType,
  type SeatingSpecialSeatType
} from '@/types/SeatingChart'
import { getSeatKey } from '@/utils/seating-chart/seatingChartUtil'

const props = defineProps<{
  chart: SeatingChartType
  visibleSeatRows: SeatPositionType[][]
  studentNames: Map<string, string>
  selectedStudentId: string | null
}>()

const emit = defineEmits<{
  dragStart: [studentId: string | null]
  dragEnd: []
  dropSeat: [seat: SeatPositionType]
  selectSeat: [seat: SeatPositionType]
  dropSpecialSeat: [position: SeatingSpecialSeatPositionEnum]
  selectSpecialSeat: [seat: SeatingSpecialSeatType]
}>()

const seatViewportRef = shallowRef<HTMLElement | null>(null)
const rows = computed(() => props.chart.rows)
const columns = computed(() => props.chart.columns)
const aisleCount = computed(() => props.chart.aisleAfterColumns.length)
// 布局键用于在行列或方向变化时触发视口重新缩放
const layoutKey = computed(() => props.chart.firstColumnSide)
const visibleColumnSeats = computed(() => props.visibleSeatRows[0] || [])
const hasSpecialSeats = computed(() => props.chart.specialSeats.some((seat) => seat.enabled))
const firstColumnOnRight = computed(
  () => props.chart.firstColumnSide === SeatingFirstColumnSideEnum.Right
)

const { stageStyle, contentStyle } = useSeatingChartViewport({
  viewportRef: seatViewportRef,
  rows,
  columns,
  aisleCount,
  layoutKey
})

/**
 * 判断座位后是否需要渲染过道。
 * @param seat - 座位位置
 */
function hasAisleAfterSeat(seat: SeatPositionType): boolean {
  // 第一列在右侧时，过道列索引需要反向换算
  const aisleColumn = firstColumnOnRight.value ? seat.column - 1 : seat.column
  return props.chart.aisleAfterColumns.includes(aisleColumn)
}

/**
 * 返回雅座位置的左右中文标签。
 * @param position - 雅座位置
 */
function specialSeatSide(position: SeatingSpecialSeatPositionEnum): string {
  return position === SeatingSpecialSeatPositionEnum.PlatformLeft ? '左' : '右'
}
</script>

<template>
  <div class="classroom">
    <div class="platform-shell">
      <div class="platform-row" :class="{ 'has-special-seats': hasSpecialSeats }">
        <template v-for="specialSeat in chart.specialSeats" :key="specialSeat.position">
          <button
            v-if="specialSeat.enabled"
            class="seat special-seat"
            :class="{
              occupied: specialSeat.studentId,
              selected: specialSeat.studentId === selectedStudentId
            }"
            draggable="true"
            @dragstart="emit('dragStart', specialSeat.studentId)"
            @dragend="emit('dragEnd')"
            @dragover.prevent
            @drop="emit('dropSpecialSeat', specialSeat.position)"
            @click="emit('selectSpecialSeat', specialSeat)"
          >
            <span v-if="specialSeat.studentId" class="seat__name">
              {{ studentNames.get(specialSeat.studentId) }}
            </span>
            <span v-else class="seat__empty">＋ 空座位</span>
            <small class="special-seat__side">{{ specialSeatSide(specialSeat.position) }}</small>
          </button>
          <div v-else-if="hasSpecialSeats" class="special-seat-placeholder"></div>
          <div
            v-if="specialSeat.position === SeatingSpecialSeatPositionEnum.PlatformLeft"
            class="platform"
          >
            讲 台
          </div>
        </template>
      </div>
    </div>

    <div ref="seatViewportRef" class="seat-viewport">
      <div class="seat-stage" :style="stageStyle">
        <div class="seat-content" :style="contentStyle">
          <div class="seat-layout">
            <div class="seat-column-headers">
              <span class="seat-axis-corner" aria-hidden="true"></span>
              <template v-for="seat in visibleColumnSeats" :key="`column-${seat.column}`">
                <span class="seat-column-header">
                  <strong class="seat-axis-number">{{ seat.column + 1 }}</strong>
                  <small class="seat-axis-unit">列</small>
                </span>
                <span
                  v-if="hasAisleAfterSeat(seat)"
                  class="aisle aisle--header"
                  aria-hidden="true"
                ></span>
              </template>
            </div>

            <div class="seat-rows">
              <div v-for="(row, rowIndex) in visibleSeatRows" :key="row[0].row" class="seat-row">
                <span class="seat-row-header">
                  <strong class="seat-axis-number">{{ row[0].row + 1 }}</strong>
                  <small class="seat-axis-unit">排</small>
                </span>
                <template v-for="seat in row" :key="getSeatKey(seat.row, seat.column)">
                  <button
                    class="seat"
                    :class="{
                      occupied: seat.studentId,
                      selected: seat.studentId === selectedStudentId
                    }"
                    draggable="true"
                    @dragstart="emit('dragStart', seat.studentId)"
                    @dragend="emit('dragEnd')"
                    @dragover.prevent
                    @drop="emit('dropSeat', seat)"
                    @click="emit('selectSeat', seat)"
                  >
                    <span v-if="seat.studentId" class="seat__name">
                      {{ studentNames.get(seat.studentId) }}
                    </span>
                    <span v-else class="seat__empty">＋ 空座位</span>
                  </button>
                  <span
                    v-if="hasAisleAfterSeat(seat)"
                    class="aisle"
                    :class="{ 'aisle--last': rowIndex === visibleSeatRows.length - 1 }"
                    aria-hidden="true"
                  ></span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.classroom {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(circle at 1px 1px, #e8e3ec 1px, transparent 0) 0 0/18px 18px #fbfafc;
}

.platform-shell {
  position: relative;
  z-index: 6;
  flex: none;
  padding: 14px 20px 8px;
}

.platform-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
  min-height: 38px;
}

.platform {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(320px, 62%);
  height: 38px;
  box-sizing: border-box;
  flex-shrink: 1;
  color: #fff;
  background: #44305f;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.42em;
  box-shadow: 0 5px 12px rgba(57, 39, 82, 0.16);
}

.platform-row.has-special-seats .platform {
  width: min(300px, calc(100% - 212px));
}

.seat {
  position: relative;
  display: grid;
  place-content: center;
  width: 96px;
  min-width: 96px;
  min-height: 58px;
  padding: 7px;
  box-sizing: border-box;
  overflow: hidden;
  color: #8b8293;
  background: #fff;
  border: 1px solid #dfd9e4;
  border-radius: 9px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(50, 35, 65, 0.045);
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.seat:hover,
.seat.selected {
  background: #fbf9fd;
  border-color: #9d82c3;
  box-shadow: 0 4px 10px rgba(86, 59, 121, 0.1);
}

.seat:focus-visible {
  outline: 2px solid #8060aa;
  outline-offset: 2px;
}

.seat.occupied {
  color: #342d3b;
}

.seat__name,
.seat__empty {
  display: block;
  max-width: 80px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seat__empty {
  color: #aaa2ae;
  font-size: 11px;
  font-weight: 500;
}

.special-seat,
.special-seat-placeholder {
  width: 96px;
  min-width: 96px;
  min-height: 58px;
}

.special-seat {
  color: #584526;
  background: #fffdf7;
  border-color: #e6d7b3;
  box-shadow: none;
}

.special-seat:hover,
.special-seat.selected {
  background: #fffbef;
  border-color: #cdb676;
}

.special-seat__side {
  position: absolute;
  top: 5px;
  right: 5px;
  display: grid;
  width: 17px;
  height: 15px;
  place-items: center;
  color: #927b4f;
  background: rgba(237, 223, 187, 0.62);
  border-radius: 5px;
  font-size: 9px;
  font-weight: 650;
  line-height: 1;
}

.special-seat .seat__name,
.special-seat .seat__empty {
  max-width: 70px;
}

.seat-viewport {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 18px 20px 22px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.seat-stage {
  position: relative;
  min-width: 0;
  margin: auto;
}

.seat-content {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

.seat-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: max-content;
}

.seat-column-headers,
.seat-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.seat-column-headers {
  position: sticky;
  top: 0;
  z-index: 4;
  height: 42px;
  background: #fbfafc;
  box-shadow: 0 12px 0 #fbfafc;
  backdrop-filter: blur(8px);
  isolation: isolate;
}

.seat-axis-corner,
.seat-row-header {
  position: sticky;
  left: 0;
  width: 42px;
  min-width: 42px;
  box-sizing: border-box;
}

.seat-axis-corner {
  z-index: 6;
  background: rgba(251, 250, 252, 0.94);
}

.seat-column-header,
.seat-row-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #fff;
  background: linear-gradient(145deg, #7548f3 0%, #5f2ee5 100%);
  border: 1px solid rgba(91, 42, 220, 0.16);
  border-radius: 9px;
  box-shadow: 0 5px 12px rgba(95, 46, 229, 0.16);
}

.seat-column-header {
  width: 42px;
  min-width: 42px;
  margin-inline: 27px;
}

.seat-row-header {
  z-index: 3;
  flex: none;
  height: 42px;
  margin-block: 8px;
}

.seat-axis-number {
  font-size: 18px;
  font-weight: 720;
  line-height: 1;
  letter-spacing: -0.04em;
}

.seat-axis-unit {
  margin-top: 5px;
  font-size: 9px;
  font-weight: 650;
  line-height: 1;
  opacity: 0.9;
}

.seat-rows {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: max-content;
}

.seat-row {
  height: 58px;
}

.aisle {
  position: relative;
  display: grid;
  width: 32px;
  min-width: 32px;
  height: 68px;
  margin-bottom: -10px;
  box-sizing: border-box;
  place-items: start center;
  background: rgba(239, 233, 252, 0.74);
  border-inline: 4px solid transparent;
  border-image: repeating-linear-gradient(-45deg, #d8c7f7 0 5px, rgba(244, 240, 253, 0.7) 5px 10px)
    1;
}

.aisle--last {
  height: 58px;
  margin-bottom: 0;
}

.aisle--header {
  height: 42px;
  margin-bottom: 0;
  background: transparent;
  border: 0;
}

@media (max-width: 820px) {
  .platform-shell {
    padding-inline: 12px;
  }

  .platform-row.has-special-seats .platform {
    width: min(250px, calc(100% - 188px));
  }

  .special-seat,
  .special-seat-placeholder {
    width: 84px;
    min-width: 84px;
  }

  .seat-viewport {
    padding-inline: 12px;
  }
}
</style>
