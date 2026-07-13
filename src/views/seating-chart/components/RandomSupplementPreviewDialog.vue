<script setup lang="ts">
import { computed } from 'vue'

import {
  SeatingViewDirectionEnum,
  type SeatingChartPreviewType,
  type SeatingChartType
} from '@/types/SeatingChart'
import { getSeatKey, getVisibleSeats } from '@/utils/seatingChartUntil'
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'

const props = defineProps<{
  modelValue: boolean
  chart: SeatingChartType
  preview: SeatingChartPreviewType
  studentNames: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  regenerate: []
  confirm: []
}>()

const visibleSeats = computed(() => getVisibleSeats({ ...props.chart, seats: props.preview.seats }))
const fixedCount = computed(() => {
  const fixedRegularCount = props.preview.seats.filter(
    (seat) => seat.studentId && !props.preview.randomizedStudentIds.includes(seat.studentId)
  ).length
  return (
    fixedRegularCount +
    props.chart.specialSeats.filter((seat) => seat.enabled && seat.studentId).length
  )
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="min(1120px, 94vw)"
    top="4vh"
    class="random-preview-dialog"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header
      ><seating-dialog-header
        icon="wand-magic-sparkles"
        title="补充空座位 · 方案预览"
        description="确认前不会修改当前座位表，可反复更换随机方案"
        tone="orange"
    /></template>
    <div class="preview-header">
      <div>
        <strong>本轮安排</strong>
        <p>固定 {{ fixedCount }} 人 · 随机补充 {{ preview.randomizedStudentIds.length }} 人</p>
      </div>
      <div class="preview-legend">
        <span><i class="preview-legend__dot preview-legend__dot--fixed"></i>原有安排</span>
        <span><i class="preview-legend__dot preview-legend__dot--random"></i>本次随机</span>
      </div>
    </div>

    <div class="preview-body">
      <div
        class="preview-classroom"
        :class="{
          'facing-students': chart.viewDirection === SeatingViewDirectionEnum.FacingStudents
        }"
      >
        <div
          class="preview-platform-row"
          :class="{
            'reverse-sides': chart.viewDirection === SeatingViewDirectionEnum.FacingStudents,
            'has-special-seats': chart.specialSeats.some((seat) => seat.enabled)
          }"
        >
          <template v-for="specialSeat in chart.specialSeats" :key="specialSeat.position"
            ><div v-if="specialSeat.enabled" class="preview-special-seat">
              <strong>{{
                specialSeat.studentId ? studentNames[specialSeat.studentId] : '空座位'
              }}</strong
              ><small>{{ specialSeat.position === 'platform-left' ? '左' : '右' }}</small>
            </div>
            <div
              v-else-if="chart.specialSeats.some((seat) => seat.enabled)"
              class="preview-special-placeholder"
            ></div>
            <div v-if="specialSeat.position === 'platform-left'" class="preview-platform">
              讲 台
            </div></template
          >
        </div>
        <div
          class="preview-grid"
          :style="{ gridTemplateColumns: `repeat(${chart.columns}, minmax(72px, 1fr))` }"
        >
          <div
            v-for="seat in visibleSeats"
            :key="getSeatKey(seat.row, seat.column)"
            class="preview-seat"
            :class="{
              random: seat.studentId && preview.randomizedStudentIds.includes(seat.studentId)
            }"
          >
            <span
              v-if="seat.studentId && preview.randomizedStudentIds.includes(seat.studentId)"
              class="preview-seat__badge"
              >随机</span
            >
            <strong>{{ seat.studentId ? studentNames[seat.studentId] : '空座位' }}</strong>
          </div>
        </div>
      </div>

      <aside class="preview-summary">
        <div class="preview-summary__stats">
          <span
            >固定学生<strong>{{ fixedCount }}</strong></span
          >
          <span
            >随机补充<strong>{{ preview.randomizedStudentIds.length }}</strong></span
          >
          <span :class="{ warning: preview.unassignedCount }"
            >未安排<strong>{{ preview.unassignedCount }}</strong></span
          >
        </div>

        <div v-if="preview.unassignedCount" class="unassigned-result">
          <div class="unassigned-result__title">
            <span><font-awesome-icon :icon="['solid', 'triangle-exclamation']" /> 未安排学生</span>
            <em>{{ preview.unassignedCount }} 人</em>
          </div>
          <div class="unassigned-result__names">
            <span v-for="studentId in preview.unassignedStudentIds" :key="studentId">
              {{ studentNames[studentId] || '未命名学生' }}
            </span>
          </div>
        </div>
        <div v-else class="all-arranged-result">
          <font-awesome-icon :icon="['solid', 'circle-check']" />
          <strong>全部学生均可安排</strong>
          <span>当前座位数量充足</span>
        </div>

        <button class="regenerate-button" type="button" @click="emit('regenerate')">
          <font-awesome-icon :icon="['solid', 'rotate']" />
          换一批方案
        </button>
        <p class="preview-summary__tip">换一批不会移动原有安排，确认前也不会保存。</p>
      </aside>
    </div>

    <template #footer>
      <div class="preview-footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" @click="emit('confirm')">确认安排</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.preview-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: -10px -4px 18px;
  padding: 4px 2px 16px;
  border-bottom: 1px solid #eee8f3;
}
.preview-header__eyebrow {
  color: #7c4bc1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.preview-header h3,
.preview-header p {
  margin: 0;
}
.preview-header h3 {
  margin-top: 3px;
  color: #2e2538;
  font-size: 22px;
}
.preview-header p {
  margin-top: 6px;
  color: #8b8194;
  font-size: 12px;
}
.preview-legend {
  display: flex;
  gap: 14px;
  color: #766c80;
  font-size: 12px;
}
.preview-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.preview-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.preview-legend__dot--fixed {
  background: #fff;
  border: 1px solid #d9d1e1;
}
.preview-legend__dot--random {
  background: #fff0e5;
  border: 1px solid #f08a45;
}
.preview-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 18px;
  min-height: 500px;
}
.preview-classroom {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  max-height: 62vh;
  padding: 22px;
  overflow: auto;
  background: radial-gradient(circle at 1px 1px, #e7dff1 1px, transparent 0) 0 0/18px 18px #fbfafe;
  border: 1px solid #e8e1ee;
  border-radius: 16px;
}
.preview-classroom.facing-students {
  flex-direction: column-reverse;
}
.preview-platform {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50%;
  min-height: 32px;
  margin: 0 auto;
  padding: 9px;
  box-sizing: border-box;
  flex-shrink: 0;
  color: #fff;
  background: linear-gradient(135deg, #36245c, #5b378f);
  border-radius: 9px;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.3em;
}
.preview-grid {
  display: grid;
  gap: 7px;
  min-width: max-content;
}
.preview-seat {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 7px;
  box-sizing: border-box;
  color: #3c3344;
  background: #fff;
  border: 1px solid #e0d9e7;
  border-radius: 8px;
  box-shadow: 0 3px 8px rgba(49, 35, 65, 0.05);
}
.preview-seat.random {
  background: #fff6ed;
  border-color: #ee8b4c;
  box-shadow: 0 4px 12px rgba(225, 108, 41, 0.1);
}
.preview-seat__badge {
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 2px 5px;
  color: #b64f12;
  background: #ffe0c7;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
}
.preview-seat strong {
  display: block;
  max-width: 68px;
  overflow: hidden;
  padding-right: 22px;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-summary {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.preview-summary__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
  background: #f7f4fa;
  border: 1px solid #e8e1ee;
  border-radius: 12px;
}
.preview-summary__stats span {
  display: grid;
  gap: 4px;
  padding: 12px 5px;
  color: #8b8194;
  text-align: center;
  font-size: 10px;
}
.preview-summary__stats span + span {
  border-left: 1px solid #e5deeb;
}
.preview-summary__stats strong {
  color: #382f42;
  font-size: 18px;
}
.preview-summary__stats .warning strong {
  color: #c7581b;
}
.unassigned-result {
  padding: 14px;
  background: #fff8f1;
  border: 1px solid #f3c49f;
  border-radius: 13px;
}
.unassigned-result__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #b7531d;
  font-size: 12px;
  font-weight: 700;
}
.unassigned-result__title em {
  font-style: normal;
}
.unassigned-result__names {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 170px;
  margin-top: 11px;
  overflow: auto;
}
.unassigned-result__names span {
  padding: 5px 8px;
  color: #70442d;
  background: #fff;
  border: 1px solid #f2d4bd;
  border-radius: 7px;
  font-size: 12px;
}
.all-arranged-result {
  display: grid;
  place-items: center;
  gap: 5px;
  padding: 22px 12px;
  color: #378269;
  background: #effaf6;
  border: 1px solid #bee5d7;
  border-radius: 13px;
  text-align: center;
}
.all-arranged-result svg {
  font-size: 22px;
}
.all-arranged-result span {
  color: #6c9d8d;
  font-size: 11px;
}
.regenerate-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: auto;
  padding: 11px;
  color: #623a9f;
  background: #fff;
  border: 1px solid #cdbce2;
  border-radius: 10px;
  cursor: pointer;
  transition: 0.2s;
}
.regenerate-button:hover {
  color: #fff;
  background: #6e45ae;
  border-color: #6e45ae;
}
.preview-summary__tip {
  margin: 0;
  color: #948a9c;
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
}
.preview-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.preview-platform-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-width: max-content;
}
.preview-platform-row.reverse-sides {
  flex-direction: row-reverse;
}
.preview-platform-row.has-special-seats .preview-platform {
  width: 230px;
  margin: 0;
}
.preview-special-seat,
.preview-special-placeholder {
  width: 72px;
  min-width: 72px;
  min-height: 46px;
  box-sizing: border-box;
}
.preview-special-seat {
  position: relative;
  display: grid;
  align-content: center;
  padding: 6px;
  color: #654619;
  background: #fffdf7;
  border: 1px solid #e6d7b3;
  border-radius: 8px;
}
.preview-special-seat strong {
  max-width: 58px;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-special-seat small {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  width: 15px;
  height: 14px;
  place-items: center;
  color: #927b4f;
  background: rgba(237, 223, 187, 0.62);
  border-radius: 4px;
  font-size: 8px;
  font-weight: 650;
}
.preview-header {
  align-items: center;
  margin: -6px 0 12px;
  padding: 0 0 10px;
}
.preview-header strong {
  color: #403648;
  font-size: 13px;
}
.preview-header p {
  margin-top: 3px;
}
.preview-body {
  min-height: 440px;
}
.preview-classroom {
  max-height: 58vh;
  padding: 18px;
}
@media (max-width: 800px) {
  .preview-body {
    grid-template-columns: 1fr;
  }
  .preview-summary {
    min-height: 260px;
  }
  .preview-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .preview-classroom {
    max-height: 50vh;
  }
}
</style>
