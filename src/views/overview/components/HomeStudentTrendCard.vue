<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'

import { homeDashboardConfig } from '@/config/home-dashboard'
import AppEChart from '@/components/AppEChart.vue'
import type { DashboardStudentOptionType, DashboardStudentTrendType } from '@/types/HomeDashboard'

interface Props {
  modelValue: string[]
  studentTrend: DashboardStudentTrendType | null
  studentOptions: DashboardStudentOptionType[]
  quickStudentNames: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const router = useRouter()
const chartMode = ref<'line' | 'bar'>('line')

const selectedValue = computed({
  get: () => props.modelValue,
  set: (value: string[]) => emit('update:modelValue', value.slice(0, homeDashboardConfig.studentTrend.maxCompareCount))
})

/**
 * 多人模式按颜色区分学生，折线和柱状两种图共用同一组配色
 */
const chartColors = ['#0f766e', '#2563eb', '#f97316']

const chartOption = computed<EChartsOption>(() => {
  const students = props.studentTrend?.students || []
  const xAxisLabels = Array.from(
    new Set(students.flatMap((student) => student.trendPoints.map((point) => point.label)))
  )

  const series: Array<LineSeriesOption | BarSeriesOption> = students.map((student, index) => {
    const studentScoreMap = new Map(student.trendPoints.map((point) => [point.label, point.score]))
    const data = xAxisLabels.map((label) => studentScoreMap.get(label) ?? null)
    const color = chartColors[index % chartColors.length]

    if (chartMode.value === 'bar') {
      return {
        name: student.name,
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: {
          color,
          borderRadius: [6, 6, 0, 0]
        },
        data
      }
    }

    return {
      name: student.name,
      type: 'line',
      smooth: true,
      symbolSize: 8,
      itemStyle: {
        color
      },
      lineStyle: {
        width: 3,
        color
      },
      data
    }
  })

  return {
    animationDuration: 600,
    color: chartColors,
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: {
        color: '#64748b'
      }
    },
    grid: {
      left: 48,
      right: 20,
      top: 46,
      bottom: 40
    },
    xAxis: {
      type: 'category',
      data: xAxisLabels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      },
      axisLabel: { color: '#64748b' }
    },
    series
  }
})

const addQuickStudent = (name: string) => {
  const nextValue = [name, ...selectedValue.value.filter((item) => item !== name)].slice(
    0,
    homeDashboardConfig.studentTrend.maxCompareCount
  )
  selectedValue.value = nextValue
}

const clearSelected = () => {
  selectedValue.value = []
}

const goToEvaluation = () => {
  router.push('/comment')
}
</script>

<template>
  <el-card class="student-trend-card">
    <div class="card-header">
      <div>
        <div class="card-title">学生趋势对比</div>
        <div class="card-subtitle">
          支持最多 {{ homeDashboardConfig.studentTrend.maxCompareCount }} 人对比，可切换折线图和柱状图
        </div>
      </div>
      <el-button text type="primary" @click="goToEvaluation">去评语页</el-button>
    </div>

    <div class="toolbar-row">
      <el-select
        v-model="selectedValue"
        class="student-select"
        multiple
        collapse-tags
        collapse-tags-tooltip
        filterable
        clearable
        :multiple-limit="homeDashboardConfig.studentTrend.maxCompareCount"
        placeholder="选择学生进行趋势对比"
      >
        <el-option
          v-for="option in studentOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>

      <el-segmented
        v-model="chartMode"
        :options="[
          { label: '折线图', value: 'line' },
          { label: '柱状图', value: 'bar' }
        ]"
      />
    </div>

    <div v-if="quickStudentNames.length" class="quick-students">
      <span class="quick-label">快捷加入</span>
      <button
        v-for="name in quickStudentNames"
        :key="name"
        class="quick-btn"
        @click="addQuickStudent(name)"
      >
        {{ name }}
      </button>
      <button v-if="selectedValue.length" class="quick-btn is-clear" @click="clearSelected">清空对比</button>
    </div>

    <template v-if="studentTrend">
      <div class="student-meta">
        <div class="meta-title">
          <span>{{ studentTrend.mode === 'compare' ? '对比视图' : studentTrend.students[0]?.name }}</span>
          <el-tag type="info" round>
            {{ studentTrend.mode === 'compare' ? `共 ${studentTrend.students.length} 人` : '单人模式' }}
          </el-tag>
        </div>
        <div class="meta-subtitle">
          {{
            studentTrend.mode === 'compare'
              ? '右侧点击学生会加入当前对比列表'
              : `已录入 ${studentTrend.students[0]?.scoreCount || 0} 个单元`
          }}
        </div>
      </div>

      <div class="chart-wrapper">
        <app-e-chart :option="chartOption" height="100%" />
      </div>

      <div class="summary-section">
        <div class="summary-title">
          {{ studentTrend.mode === 'compare' ? '对比摘要' : '学情摘要' }}
        </div>
        <ul class="summary-list">
          <li v-for="summary in studentTrend.summaries" :key="summary">{{ summary }}</li>
        </ul>
      </div>

      <div class="comment-section">
        <div class="summary-title">
          {{ studentTrend.mode === 'compare' ? '评语状态' : '评语预览' }}
        </div>
        <div v-if="studentTrend.mode === 'compare'" class="compare-comment-list">
          <div v-for="student in studentTrend.students" :key="student.name" class="compare-comment-item">
            <span class="comment-name">{{ student.name }}</span>
            <span class="comment-status">
              {{ student.completedComment ? '已有评语' : '未写评语' }}
            </span>
          </div>
        </div>
        <div v-else class="comment-content">
          {{
            studentTrend.students[0]?.commentPreview
              ? `${studentTrend.students[0].commentPreview}${studentTrend.students[0].commentPreview.length >= 60 ? '...' : ''}`
              : '暂无评语，可前往评语页继续处理'
          }}
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <font-awesome-icon :icon="['solid', 'user-graduate']" />
      <p>可通过多选搜索或点击右侧学生名单进行趋势对比</p>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.student-trend-card {
  min-height: 520px;
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.toolbar-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.student-select {
  width: 100%;
}

.quick-students {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.quick-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.quick-btn {
  padding: 5px 10px;
  border: 1px solid var(--border-muted);
  border-radius: 999px;
  background: #fff;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.is-clear {
  color: #dc2626;
}

.student-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.meta-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.chart-wrapper {
  min-height: 280px;
  flex: 1;
}

.summary-section,
.comment-section {
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
}

.summary-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.comment-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.compare-comment-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-comment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.comment-name {
  color: var(--text-primary);
  font-weight: 600;
}

.comment-status {
  color: var(--text-secondary);
}

.empty-state {
  flex: 1;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #94a3b8;

  svg {
    font-size: 42px;
    color: var(--theme-primary);
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}
</style>
