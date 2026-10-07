<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import { useSeatingChartStore } from '@/stores/seating-chart'
import {
  rotateSeatingChart,
  SeatingRotationDirectionEnum
} from '@/utils/seating-chart/seatingRotationUtil'

const visible = defineModel<boolean>({ required: true })
const store = useSeatingChartStore()
const direction = ref(SeatingRotationDirectionEnum.Forward)
const steps = ref(1)
const fixedIds = ref<string[]>([])
const chart = computed(() => store.editingChart)
const names = computed(() =>
  Object.fromEntries(store.activeStudents.map((student) => [student.id, student.name]))
)
const result = computed(() => {
  try {
    return {
      seats: chart.value
        ? rotateSeatingChart(chart.value, direction.value, steps.value, fixedIds.value)
        : [],
      error: ''
    }
  } catch (error) {
    return { seats: [], error: error instanceof Error ? error.message : '无法轮换' }
  }
})
const changes = computed(() =>
  result.value.seats.flatMap((seat) => {
    const before = chart.value?.seats.find((item) => item.studentId === seat.studentId)
    if (!seat.studentId || !before || (before.row === seat.row && before.column === seat.column))
      return []
    return [
      {
        name: names.value[seat.studentId] || seat.studentId,
        from: `${before.row + 1} 排 ${before.column + 1} 列`,
        to: `${seat.row + 1} 排 ${seat.column + 1} 列`
      }
    ]
  })
)
watch(visible, (value) => {
  if (value) fixedIds.value = [...(chart.value?.rotationFixedStudentIds || [])]
})

/** 保存独立的新方案，保留原方案便于回退。 */
function apply(): void {
  if (!chart.value || result.value.error || !changes.value.length) return
  const seats = result.value.seats.map((seat) => ({ ...seat }))
  const name = `${chart.value.name} · 轮换`
  store.copyChart(chart.value.id)
  if (!store.editingChart) return
  store.editingChart.seats = seats
  store.editingChart.name = name
  store.editingChart.rotationFixedStudentIds = [...fixedIds.value]
  visible.value = false
  ElMessage.success('已生成轮换方案，原方案已保留')
}
</script>

<template>
  <el-dialog v-model="visible" title="座位轮换" width="720px" append-to-body>
    <el-form label-width="100px">
      <el-form-item label="轮换方向"
        ><el-select v-model="direction"
          ><el-option
            label="向前（靠近讲台）"
            :value="SeatingRotationDirectionEnum.Forward" /><el-option
            label="向后（远离讲台）"
            :value="SeatingRotationDirectionEnum.Backward" /><el-option
            label="向左"
            :value="SeatingRotationDirectionEnum.Left" /><el-option
            label="向右"
            :value="SeatingRotationDirectionEnum.Right" /></el-select
      ></el-form-item>
      <el-form-item label="移动步数"
        ><el-input-number v-model="steps" :min="1" :max="20"
      /></el-form-item>
      <el-form-item label="固定学生"
        ><el-select v-model="fixedIds" multiple filterable placeholder="选择保持原座位的学生"
          ><el-option
            v-for="student in store.activeStudents"
            :key="student.id"
            :label="student.name"
            :value="student.id" /></el-select
      ></el-form-item>
    </el-form>
    <el-alert
      :closable="false"
      :type="result.error ? 'error' : 'info'"
      :title="
        result.error ||
        `将移动 ${changes.length} 人；空位、固定学生和雅座保持原位，其他学生循环补位。排号从讲台开始。`
      "
    />
    <el-table :data="changes" height="280"
      ><el-table-column prop="name" label="姓名" /><el-table-column
        prop="from"
        label="原座位" /><el-table-column prop="to" label="新座位"
    /></el-table>
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :disabled="!!result.error || !changes.length" @click="apply"
        >另存为轮换方案</el-button
      ></template
    >
  </el-dialog>
</template>
