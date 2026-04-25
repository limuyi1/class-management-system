<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'
import { ElMessage } from 'element-plus'

import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import AppEChart from '@/components/AppEChart.vue'
import OverlengthTextTooltip from '@/components/OverlengthTextTooltip.vue'
import type { DashboardStudentOptionType, DashboardStudentTrendType } from '@/types/HomeDashboard'

interface Props {
  /** 当前选中的学生姓名数组（v-model） */
  modelValue: string[]
  /** 趋势分析数据，支持单人和多人对比 */
  studentTrend: DashboardStudentTrendType | null
  /** 学生下拉选项列表 */
  studentOptions: DashboardStudentOptionType[]
  /** 快捷添加按钮的学生名单（来自关注列表） */
  quickStudentNames: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'go-evaluation': []
}>()

const chartMode = ref<'line' | 'bar'>('line')
const emptyCommentText = '暂无评语，可前往评语页继续处理'
const maxCompareCount = overviewDashboardConfig.studentTrend.maxCompareCount

const showMaxCompareWarning = () => {
  ElMessage.warning(`最多只能对比 ${maxCompareCount} 名学生`)
}

/**
 * 选中学生的计算属性，支持上限拦截。
 * 超过最大对比人数时自动拒绝并提示。
 */
const selectedValue = computed({
  get: () => props.modelValue,
  set: (value: string[]) => {
    if (value.length > maxCompareCount) {
      showMaxCompareWarning()
      return
    }

    emit('update:modelValue', value)
  }
})

/**
 * 多人模式按颜色区分学生，折线和柱状两种图共用同一组配色。
 * 最多支持 5 名学生同时对比。
 */
const chartColors = ['#0f766e', '#2563eb', '#f97316', '#dc2626', '#7c3aed']
const chartAreaColors = [
  'rgba(15, 118, 110, 0.1)',
  'rgba(37, 99, 235, 0.1)',
  'rgba(249, 115, 22, 0.1)',
  'rgba(220, 38, 38, 0.1)',
  'rgba(124, 58, 237, 0.1)'
]

const formatTooltipRows = (params: unknown) => {
  const items = Array.isArray(params)
    ? (params as Array<{ axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }>)
    : []
  const title = items[0]?.axisValueLabel || ''
  const rows = items
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
    .map((item) => {
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:6px;">
        <span>${item.marker || ''}${item.seriesName || ''}</span>
        <strong style="color:#0f172a;">${item.value} 分</strong>
      </div>`
    })
    .join('')

  return `<div style="min-width:140px;">
    <div style="font-weight:600;color:#0f172a;margin-bottom:2px;">${title}</div>
    ${rows}
  </div>`
}

/**
 * 图表配置，支持折线和柱状两种模式。
 *
 * 图表特点：
 * - 单人模式：折线图显示分数标签
 * - 多人模式：各学生使用不同颜色区分
 * - X 轴显示单元名称
 * - Y 轴固定 0-100 分范围
 */
const chartOption = computed<EChartsOption>(() => {
  const students = props.studentTrend?.students || []
  const shouldShowLineScoreLabel = props.studentTrend?.mode === 'single'
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
        label: {
          show: true,
          position: 'inside',
          color: '#ffffff',
          fontSize: 11,
          fontWeight: 600,
          formatter: ({ value }) => (typeof value === 'number' ? String(value) : '')
        },
        data
      }
    }

    return {
      name: student.name,
      type: 'line',
      smooth: true,
      smoothMonotone: 'x',
      symbolSize: 8,
      itemStyle: {
        color
      },
      lineStyle: {
        width: 3,
        color
      },
      areaStyle: {
        color: chartAreaColors[index % chartAreaColors.length]
      },
      label: {
        show: shouldShowLineScoreLabel,
        position: 'top',
        color,
        fontSize: 11,
        fontWeight: 600,
        formatter: ({ value }) => (typeof value === 'number' ? String(value) : '')
      },
      data
    }
  })

  return {
    animationDuration: 800,
    animationEasing: 'cubicOut',
    color: chartColors,
    tooltip: {
      trigger: 'axis',
      confine: true,
      padding: [10, 12],
      borderWidth: 1,
      borderColor: '#e2e8f0',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      textStyle: {
        color: '#334155'
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#94a3b8',
          type: 'dashed'
        }
      },
      formatter: formatTooltipRows
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
          color: '#edf2f7'
        }
      },
      axisLabel: { color: '#64748b' }
    },
    series
  }
})

/**
 * 快捷添加学生到对比列表。
 * 已选中学生会被移到列表首位，未选中学生会追加到末尾。
 */
const addQuickStudent = (name: string) => {
  if (!selectedValue.value.includes(name) && selectedValue.value.length >= maxCompareCount) {
    showMaxCompareWarning()
    return
  }

  const nextValue = [name, ...selectedValue.value.filter((item) => item !== name)]
  selectedValue.value = nextValue
}

const clearSelected = () => {
  selectedValue.value = []
}

const goToEvaluation = () => {
  emit('go-evaluation')
}
</script>

<template>
  <div class="student-trend-panel">
    <div class="toolbar-row">
      <el-select
        v-model="selectedValue"
        class="student-select"
        multiple
        filterable
        clearable
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
      <el-button text type="primary" @click="goToEvaluation">去评语页</el-button>
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
        <div v-if="studentTrend.mode === 'single' && studentTrend.students[0]?.tags.length" class="meta-tags">
          <el-tag
            v-for="tag in studentTrend.students[0].tags"
            :key="`${studentTrend.students[0]?.name}-${tag.key}`"
            size="small"
            round
            effect="plain"
          >
            {{ tag.label }}
          </el-tag>
        </div>
      </div>

      <div class="chart-wrapper">
        <app-e-chart :option="chartOption" height="100%" />
      </div>

      <div class="summary-panels">
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
            {{ studentTrend.mode === 'compare' ? '评语概览' : '评语预览' }}
          </div>
          <div v-if="studentTrend.mode === 'compare'" class="compare-comment-list">
            <div v-for="student in studentTrend.students" :key="student.name" class="compare-comment-item">
              <div class="comment-name">{{ student.name }}</div>
              <div class="comment-body">
                <div v-if="student.tags.length" class="compare-tags">
                  <el-tag v-for="tag in student.tags" :key="`${student.name}-${tag.key}`" size="small" round>
                    {{ tag.label }}
                  </el-tag>
                </div>
                <overlength-text-tooltip
                  :content="student.commentPreview || emptyCommentText"
                  :level="1"
                  custom-class="comment-status"
                  :custom-style="{ width: '100%', color: 'var(--text-secondary)', lineHeight: '1.6' }"
                />
              </div>
            </div>
          </div>
          <overlength-text-tooltip
            v-else
            :content="studentTrend.students[0]?.commentPreview || emptyCommentText"
            :level="5"
            custom-class="comment-content"
            :custom-style="{
              flex: 1,
              width: '100%',
              color: 'var(--text-secondary)',
              lineHeight: '1.7'
            }"
          />
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <font-awesome-icon :icon="['solid', 'user-graduate']" />
      <p>可通过多选搜索或点击右侧学生名单进行趋势对比</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.student-trend-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
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

.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chart-wrapper {
  height: 320px;
  min-height: 320px;
  flex: 0 0 320px;
}

.summary-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-section,
.comment-section {
  min-height: 0;
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
}

.comment-section {
  display: flex;
  flex-direction: column;
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

:deep(.comment-content) {
  flex: 1;
  font-size: 12px;
}

.compare-comment-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.compare-comment-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  font-size: 12px;
}

.comment-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.comment-name {
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
}

:deep(.comment-status) {
  min-width: 0;
  font-size: 12px;
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

@media (max-width: 960px) {
  .toolbar-row {
    grid-template-columns: 1fr;
  }

  .chart-wrapper {
    height: 280px;
    min-height: 280px;
    flex-basis: 280px;
  }

  .summary-panels {
    grid-template-columns: 1fr;
  }
}
</style>
