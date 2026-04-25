<script setup lang="ts">
import { computed } from 'vue'
import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'

import { homeDashboardConfig } from '@/config/home-dashboard'
import AppEChart from '@/components/AppEChart.vue'
import type { DashboardTeachingInsightType, DashboardUnitOverviewType } from '@/types/HomeDashboard'

interface Props {
  unitOverview: DashboardUnitOverviewType[]
  teachingInsights: DashboardTeachingInsightType[]
}

const props = defineProps<Props>()

const formatTooltipRows = (params: unknown, validCountMap: Map<string, number>) => {
  const items = Array.isArray(params)
    ? (params as Array<{ axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }>)
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

const chartOption = computed<EChartsOption>(() => {
  const labels = props.unitOverview.map((item) => item.label)
  const showDataZoom = labels.length > homeDashboardConfig.unitOverview.dataZoomThreshold
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
      barMaxWidth: 20,
      barGap: '8%',
      itemStyle: {
        borderRadius: [6, 6, 0, 0]
      },
      label: {
        show: true,
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
    color: ['#0f766e', ...(props.unitOverview[0]?.scoreBands.map((item) => item.color) || [])],
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
            startValue: 0,
            endValue: homeDashboardConfig.unitOverview.dataZoomVisibleCount - 1
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            bottom: 12,
            height: 20,
            brushSelect: false
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
  <el-card class="unit-overview-card">
    <div class="card-header">
      <div>
        <div class="card-title">单元成绩概览</div>
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

.chart-wrapper {
  flex: 1;
  min-height: 320px;
}
</style>
