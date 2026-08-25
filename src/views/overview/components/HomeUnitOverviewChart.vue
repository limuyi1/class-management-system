<script setup lang="ts">
/** 单元成绩概览图表 — 展示各单元均分折线与分数段人数柱状图 */
import { computed } from 'vue'
import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'

import EmptyStatePanel from '@/components/EmptyStatePanel.vue'
import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import AppEChart from '@/components/AppEChart.vue'
import type {
  DashboardTeachingInsightType,
  DashboardUnitOverviewType,
  OverviewDashboardStageType
} from '@/types/HomeDashboard'

interface Props {
  /** 单元概览数据，包含每个单元的均分、分数段分布 */
  unitOverview: DashboardUnitOverviewType[]
  /** 教学提示数据（暂未使用，预留用于图表注释） */
  teachingInsights: DashboardTeachingInsightType[]
  /** 总览页当前数据阶段，用于展示更具体的空态 */
  stage: OverviewDashboardStageType
}

const props = defineProps<Props>()

/** 对外事件：跳转单元设置、跳转成绩录入 */
const emit = defineEmits<{
  goUnitSetting: []
  goScoreInput: []
}>()

/** 平均分折线主题色 */
const averageScoreColor = '#7c3aed'

/** 根据页面阶段生成空态面板的图标、文案与跳转动作 */
const emptyState = computed(() => {
  if (props.stage === 'noUnits') {
    return {
      icon: 'table-columns',
      title: '还没有设置单元',
      description: '添加单元后，可以在这里查看班级均分、分数段和有效人数变化。',
      actionText: '去设置单元',
      action: () => emit('goUnitSetting')
    }
  }

  return {
    icon: 'pen-to-square',
    title: '单元已设置，暂无成绩',
    description: '录入成绩后，这里会展示各单元均分和分数段分布。',
    actionText: '去录入成绩',
    action: () => emit('goScoreInput')
  }
})

/**
 * 格式化 ECharts 提示框内容。
 * 显示单元名称、有效人数、各分数段人数。
 */
const formatTooltipRows = (params: unknown, validCountMap: Map<string, number>) => {
  const items = Array.isArray(params)
    ? (params as Array<{
        axisValueLabel?: string
        marker?: string
        seriesName?: string
        value?: unknown
      }>)
    : []
  const title = items[0]?.axisValueLabel || ''
  const validCount = validCountMap.get(title) || 0
  const rows = items
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
    .map((item) => {
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:6px;">
        <span>${item.marker || ''}${item.seriesName || ''}</span>
        <strong style="color:#0f172a;">${item.value}</strong>
      </div>`
    })
    .join('')

  return `<div style="min-width:150px;">
    <div style="font-weight:600;color:#0f172a;margin-bottom:2px;">${title}</div>
    <div style="font-size:12px;color:#64748b;">有效人数 ${validCount} 人</div>
    ${rows}
  </div>`
}

/**
 * 图表配置。
 *
 * 图表结构：
 * - X 轴：单元名称 + 有效人数
 * - 左侧 Y 轴：平均分（折线图）
 * - 右侧 Y 轴：各分数段人数（柱状图）
 *
 * 响应式：
 * - 单元数超过阈值时启用缩放组件
 * - 分数段人数为 0 时隐藏标签
 */
const chartOption = computed<EChartsOption>(() => {
  const labels = props.unitOverview.map((item) => item.label)
  const showDataZoom = labels.length > overviewDashboardConfig.unitOverview.dataZoomThreshold
  const dataZoomVisibleCount = overviewDashboardConfig.unitOverview.dataZoomVisibleCount
  const dataZoomStartValue = Math.max(0, labels.length - dataZoomVisibleCount)
  const dataZoomEndValue = Math.max(0, labels.length - 1)
  const validCountMap = new Map(props.unitOverview.map((item) => [item.label, item.validCount]))
  const bandLabels = props.unitOverview[0]?.scoreBands.map((item) => item.label) || []
  const series: Array<BarSeriesOption | LineSeriesOption> = [
    {
      name: '平均分',
      type: 'line',
      yAxisIndex: 0,
      smooth: true,
      symbolSize: 10,
      itemStyle: {
        color: averageScoreColor
      },
      lineStyle: {
        width: 3,
        color: averageScoreColor
      },
      areaStyle: {
        color: 'rgba(124, 58, 237, 0.1)'
      },
      label: {
        show: true,
        position: 'top',
        color: '#0f172a'
      },
      data: props.unitOverview.map((item) => item.averageScore)
    },
    ...bandLabels.map((label, index) => ({
      name: label,
      type: 'bar' as const,
      yAxisIndex: 1,
      barMaxWidth: 20,
      barGap: '8%',
      itemStyle: {
        color: props.unitOverview[0]?.scoreBands[index]?.color,
        borderRadius: [6, 6, 0, 0]
      },
      label: {
        show: true,
        hideOverlap: true,
        position: 'inside' as const,
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 600,
        formatter: (params: { value: unknown }) => {
          const value = typeof params.value === 'number' ? params.value : Number(params.value || 0)
          return value > 0 ? String(value) : ''
        }
      },
      emphasis: {
        focus: 'series' as const
      },
      data: props.unitOverview.map((item) => item.scoreBands[index]?.count || 0)
    }))
  ]

  return {
    animationDuration: 800,
    animationEasing: 'cubicOut',
    color: [
      averageScoreColor,
      ...(props.unitOverview[0]?.scoreBands.map((item) => item.color) || [])
    ],
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
      formatter: (params: unknown) => formatTooltipRows(params, validCountMap)
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
      left: 52,
      right: 52,
      top: 48,
      bottom: showDataZoom ? 70 : 42
    },
    dataZoom: showDataZoom
      ? [
          {
            type: 'inside',
            xAxisIndex: 0,
            startValue: dataZoomStartValue,
            endValue: dataZoomEndValue
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            bottom: 12,
            height: 20,
            brushSelect: false,
            showDetail: false
          }
        ]
      : [],
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: {
        color: '#64748b',
        interval: 0,
        margin: 6,
        formatter: (value: string) => `{name|${value}}\n{count|${validCountMap.get(value) || 0}人}`,
        rich: {
          name: {
            color: '#64748b',
            fontSize: 12,
            lineHeight: 14
          },
          count: {
            color: '#94a3b8',
            fontSize: 11,
            lineHeight: 13
          }
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: 100,
        splitNumber: 5,
        name: '平均分',
        nameTextStyle: {
          color: '#64748b'
        },
        splitLine: {
          lineStyle: {
            color: '#edf2f7'
          }
        },
        axisLabel: { color: '#64748b' }
      },
      {
        type: 'value',
        position: 'right',
        alignTicks: true,
        splitNumber: 5,
        minInterval: 1,
        name: '人数',
        nameTextStyle: {
          color: '#64748b'
        },
        splitLine: {
          show: false
        },
        axisLabel: { color: '#64748b' }
      }
    ],
    series
  }
})
</script>

<template>
  <el-card class="unit-overview-card" :class="{ 'is-empty-stage': !unitOverview.length }">
    <!-- 卡片头部：标题与单元数标签 -->
    <div class="card-header">
      <div>
        <div class="card-title">单元成绩概览</div>
      </div>
      <el-tag v-if="unitOverview.length" effect="plain" round>
        共 {{ unitOverview.length }} 个单元
      </el-tag>
    </div>

    <!-- 有单元数据时渲染图表 -->
    <div v-if="unitOverview.length" class="chart-wrapper">
      <app-e-chart :option="chartOption" height="100%" />
    </div>

    <!-- 无单元数据时的空态面板 -->
    <empty-state-panel
      v-else
      :icon="emptyState.icon"
      :title="emptyState.title"
      :description="emptyState.description"
      :action-text="emptyState.actionText"
      min-height="210px"
      description-max-width="680px"
      @action="emptyState.action"
    />
  </el-card>
</template>

<style scoped lang="scss">
.unit-overview-card {
  height: 100%;
  min-height: 400px;
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
  }
}

.unit-overview-card.is-empty-stage {
  min-height: 300px;
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

.chart-wrapper {
  flex: 1;
  min-height: 320px;
}

@media (max-width: 1120px) {
  :deep(.empty-state-panel__description) {
    --empty-state-description-max-width: 420px;
  }
}
</style>
