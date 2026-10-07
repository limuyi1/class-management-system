<script setup lang="ts">
import { onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { apiRequest } from '@/api/client'
const props = defineProps<{ ownerId: string; workspaceId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
interface PointType {
  label: string
  value: number | null
  percent: number | null
  rank: number | null
}
interface AnalysisType {
  units: {
    id: string
    label: string
    average: number | null
    count: number
    missing: number
    min: number | null
    max: number | null
    buckets: number[]
  }[]
  students: {
    studentId: string
    name: string
    average: number | null
    missing: number
    points: PointType[]
    history: PointType[]
  }[]
}
const data = ref<AnalysisType | null>(null),
  selected = ref(''),
  chartEl = ref<HTMLElement>(),
  busy = ref(false)
let chart: echarts.ECharts | undefined,
  generation = 0
async function load(): Promise<void> {
  const current = ++generation,
    owner = props.ownerId
  busy.value = true
  emit('busy', true)
  try {
    const result = await apiRequest<AnalysisType>(`/workspaces/${props.workspaceId}/analysis`, {
      ownerId: owner
    })
    if (current === generation) {
      data.value = result
      await render()
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '统计读取失败')
  } finally {
    if (current === generation) {
      busy.value = false
      emit('busy', false)
    }
  }
}
async function render(): Promise<void> {
  await nextTick()
  if (!chartEl.value || !data.value) return
  chart ||= echarts.init(chartEl.value)
  const student = data.value.students.find((row) => row.studentId === selected.value)
  const points = student
    ? [...student.history, ...student.points]
    : data.value.units.map((unit) => ({ label: unit.label, value: unit.average }))
  chart.setOption(
    {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: points.map((row) => row.label) },
      yAxis: { type: 'value' },
      series: [
        {
          type: student ? 'line' : 'bar',
          data: points.map((row) =>
            student ? ('percent' in row ? row.percent : null) : row.value
          ),
          connectNulls: false
        }
      ]
    },
    true
  )
}
watch(selected, () => void render())
watch(
  () => [props.ownerId, props.workspaceId],
  () => {
    data.value = null
    selected.value = ''
    void load()
  },
  { immediate: true }
)
const resize = () => chart?.resize()
window.addEventListener('resize', resize)
onBeforeUnmount(() => {
  generation++
  chart?.dispose()
  window.removeEventListener('resize', resize)
  emit('busy', false)
})
</script>
<template>
  <section>
    <el-button :loading="busy" @click="load">刷新分析</el-button
    ><el-select v-model="selected" clearable placeholder="选择学生查看历史趋势"
      ><el-option
        v-for="student in data?.students"
        :key="student.studentId"
        :value="student.studentId"
        :label="student.name"
    /></el-select>
    <p>本期统计仅含有效名单及本期测评；学生趋势可含历史参照，缺失保持断点，排名按原名单计算。</p>
    <div ref="chartEl" style="height: 340px"></div>
    <el-table :data="data?.units || []"
      ><el-table-column prop="label" label="测评" /><el-table-column
        prop="average"
        label="均分"
      /><el-table-column prop="count" label="已录" /><el-table-column
        prop="missing"
        label="缺失"
      /><el-table-column prop="min" label="最低" /><el-table-column
        prop="max"
        label="最高"
      /><el-table-column label="分布（≥90/80/60/40%/低于40%）"
        ><template #default="{ row }">{{ row.buckets.join(' / ') }}</template></el-table-column
      ></el-table
    ><el-table :data="data?.students || []"
      ><el-table-column prop="name" label="学生" /><el-table-column
        prop="average"
        label="平均得分率 %" /><el-table-column prop="missing" label="缺失测评"
    /></el-table>
  </section>
</template>
