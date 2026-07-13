<script setup lang="ts">
import { SeatingSpecialSeatPositionEnum, type SeatingSpecialSeatType } from '@/types/SeatingChart'
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'

defineProps<{
  modelValue: boolean
  seats: SeatingSpecialSeatType[]
  studentNames: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  toggle: [position: SeatingSpecialSeatPositionEnum, enabled: boolean]
}>()

function labelOf(position: SeatingSpecialSeatPositionEnum): string {
  return position === SeatingSpecialSeatPositionEnum.PlatformLeft ? '左' : '右'
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="560px"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header
      ><seating-dialog-header
        icon="crown"
        title="雅座设置"
        description="讲台两侧特别关注座位，仅参与手动安排"
        tone="gold"
    /></template>
    <div class="special-seat-settings">
      <div v-for="seat in seats" :key="seat.position" class="special-seat-setting">
        <div>
          <strong>{{ labelOf(seat.position) }}</strong
          ><span>{{
            seat.studentId
              ? `当前：${studentNames[seat.studentId] || '未命名学生'}`
              : '暂未安排学生'
          }}</span>
        </div>
        <el-switch
          :model-value="seat.enabled"
          @change="emit('toggle', seat.position, $event as boolean)"
        />
      </div>
    </div>
    <template #footer
      ><el-button type="primary" @click="emit('update:modelValue', false)"
        >完成</el-button
      ></template
    >
  </el-dialog>
</template>

<style scoped lang="scss">
.special-seat-settings {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.special-seat-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  background: #fcfbfd;
  border: 1px solid #ebe5ef;
  border-radius: 11px;
}
.special-seat-setting > div {
  display: grid;
  min-width: 0;
  gap: 4px;
}
.special-seat-setting strong {
  color: #3e3547;
  font-size: 13px;
}
.special-seat-setting span {
  overflow: hidden;
  color: #958a9d;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
