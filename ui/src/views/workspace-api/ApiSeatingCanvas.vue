<script setup lang="ts">
import { computed, ref } from 'vue'
import SeatingChartCanvas from '@/views/seating-chart/components/SeatingChartCanvas.vue'
import UnassignedStudentPanel from '@/views/seating-chart/components/UnassignedStudentPanel.vue'
import { moveClassroomSeat } from '@/utils/apiClassroomInteractionUtil'
import type {
  SeatingChartType,
  SeatPositionType,
  SeatingSpecialSeatType,
  SeatingSpecialSeatPositionEnum
} from '@/types/SeatingChart'
import type { StudentSourceStudentType } from '@/types/StudentSource'
const chart = defineModel<SeatingChartType>({ required: true })
const props = defineProps<{ students: StudentSourceStudentType[] }>()
const dragged = ref<string | null>(null)
const selected = ref<string | null>(null)
const names = computed(() => new Map(props.students.map((row) => [row.id, row.name])))
const unassigned = computed(() => {
  const assigned = new Set(
    [...chart.value.seats, ...chart.value.specialSeats].map((seat) => seat.studentId)
  )
  return props.students.filter((student) => !assigned.has(student.id))
})
const rows = computed(() =>
  Array.from({ length: chart.value.rows }, (_, row) =>
    chart.value.seats
      .filter((seat) => seat.row === row)
      .sort((a, b) =>
        chart.value.firstColumnSide === 'left' ? a.column - b.column : b.column - a.column
      )
  )
)
function place(target: SeatPositionType | SeatingSpecialSeatType, id: string | null): void {
  if (!id || !props.students.some((student) => student.id === id)) return
  if ('enabled' in target && !target.enabled) return
  moveClassroomSeat(chart.value, id, target)
  dragged.value = null
  selected.value = null
}
function special(position: SeatingSpecialSeatPositionEnum): void {
  const seat = chart.value.specialSeats.find((row) => row.position === position)
  if (seat) place(seat, dragged.value)
}
function recycle(): void {
  const id = dragged.value || selected.value
  if (!id) return
  for (const seat of [...chart.value.seats, ...chart.value.specialSeats])
    if (seat.studentId === id) seat.studentId = null
  dragged.value = null
  selected.value = null
}
</script>
<template>
  <div class="api-seating-canvas">
    <div class="api-seating-canvas__board">
      <SeatingChartCanvas
        :chart="chart"
        :visible-seat-rows="rows"
        :student-names="names"
        :selected-student-id="selected"
        :role-definitions="chart.roleDefinitions"
        :role-assignments="chart.roleAssignments"
        @drag-start="dragged = $event"
        @drag-end="dragged = null"
        @drop-seat="place($event, dragged)"
        @select-seat="selected ? place($event, selected) : (selected = $event.studentId)"
        @drop-special-seat="special"
        @select-special-seat="selected ? place($event, selected) : (selected = $event.studentId)"
      />
    </div>
    <UnassignedStudentPanel
      :students="unassigned"
      :total-student-count="students.length"
      :selected-student-id="selected"
      @drag-start="dragged = $event"
      @drag-end="dragged = null"
      @select-student="selected = $event"
      @drop-to-unassigned="recycle"
    />
  </div>
</template>
<style scoped lang="scss">
.api-seating-canvas {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  height: 600px;
  margin: 20px 0;
  &__board {
    min-width: 0;
    overflow: hidden;
  }
}
</style>
