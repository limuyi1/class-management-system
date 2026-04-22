<script setup lang="ts">
import { computed } from 'vue'
import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'

import AppEChart from '@/components/AppEChart.vue'
import type { DashboardUnitOverviewType } from '@/types/HomeDashboard'

interface Props {
  unitOverview: DashboardUnitOverviewType[]
}

const props = defineProps<Props>()

/**
 * 单元总览图改为共用横坐标的双纵轴图：
 * 左侧纵轴展示平均分，右侧纵轴展示各分数段人数
 */
const chartOption = computed<EChartsOption>(() => {
  const labels = props.unitOverview.map((item) => item.label)
  const bandLabels = props.unitOverview[0]?.scoreBands.map((item) => item.label) || []
  const series: Array<BarSeriesOption | LineSeriesOption> = [
    {
      name: '平均分',
      type: 'line',
      yAxisIndex: 0,
      smooth: true,
      symbolSize: 10,
      itemStyle: {
        color: '#0f766e'
      },
      lineStyle: {
        width: 3,
        color: '#0f766e'
      },
      areaStyle: {
        color: 'rgba(15, 118, 110, 0.12)'
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
      barMaxWidth: 14,
      barGap: '12%',
      label: {
        show: true,
        position: 'insideTop' as const,
        distance: 4,
        color: '#ffffff',
        fontSize: 11,
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
    animationDuration: 600,
    color: ['#0f766e', ...(props.unitOverview[0]?.scoreBands.map((item) => item.color) || [])],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line'
      }
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
      bottom: 64
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        startValue: 0,
        endValue: Math.min(labels.length - 1, 5)
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        bottom: 18,
        height: 20,
        brushSelect: false
      }
    ],
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: 100,
        name: '平均分',
        nameTextStyle: {
          color: '#64748b'
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        },
        axisLabel: { color: '#64748b' }
      },
      {
        type: 'value',
        position: 'right',
        minInterval: 1,
        name: '人数',
        nameTextStyle: {
          color: '#64748b'
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        },
        axisLabel: { color: '#64748b' }
      }
    ],
    series
  }
})
</script>

<template>
  <el-card class="unit-overview-card">
    <div class="card-header">
      <div>
        <div class="card-title">单元成绩概览</div>
        <div class="card-subtitle">共用横轴，左侧看平均分走势，右侧看各分数段人数</div>
      </div>
      <el-tag effect="plain" round>共 {{ unitOverview.length }} 个单元</el-tag>
    </div>

    <div v-if="unitOverview.length" class="chart-wrapper">
      <app-e-chart :option="chartOption" height="100%" />
    </div>

    <el-empty v-else description="暂无可展示的单元成绩"></el-empty>
  </el-card>
</template>

<style scoped lang="scss">
.unit-overview-card {
  min-height: 420px;
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
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

.chart-wrapper {
  flex: 1;
  min-height: 360px;
}
</style>
