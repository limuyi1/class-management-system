<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent
} from 'echarts/components'
import { init, use } from 'echarts/core'
import type { EChartsType } from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { CanvasRenderer } from 'echarts/renderers'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * ECharts 通用封装组件。
 *
 * 按需注册图表与组件，接收 option 配置后渲染图表，
 * 并在尺寸变化时自动 resize、组件卸载时释放实例。
 */
use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  DataZoomComponent,
  CanvasRenderer
])

interface Props {
  option: EChartsOption
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: '100%'
})

const chartRef = ref<HTMLDivElement>()
let chartInstance: EChartsType | null = null

/**
 * 初始化图表实例
 * 单独抽出后，便于在尺寸变化和组件重建时复用
 */
const initChart = async () => {
  await nextTick()
  if (!chartRef.value) return

  if (!chartInstance) {
    chartInstance = init(chartRef.value)
  }

  chartInstance.setOption(props.option, true)
}

watch(
  () => props.option,
  () => {
    if (!chartInstance) {
      initChart()
      return
    }
    chartInstance.setOption(props.option, true)
  },
  {
    deep: true
  }
)

useResizeObserver(chartRef, () => {
  chartInstance?.resize()
})

onMounted(() => {
  initChart()
})

onBeforeUnmount(() => {
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div ref="chartRef" class="app-echart" :style="{ height }"></div>
</template>

<style scoped lang="scss">
.app-echart {
  width: 100%;
  min-height: 0;
}
</style>
