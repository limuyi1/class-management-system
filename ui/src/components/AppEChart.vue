<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'

import type { EChartsType } from 'echarts/core'
import type { EChartsOption } from 'echarts'

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
  CanvasRenderer,
  SVGRenderer
])

interface Props {
  /** ECharts 配置项 */
  option: EChartsOption
  /** 图表容器高度 */
  height?: string
  /** 打印场景使用 SVG，放大时文字和曲线保持清晰 */
  renderer?: 'canvas' | 'svg'
}

const props = withDefaults(defineProps<Props>(), {
  height: '100%',
  renderer: 'canvas'
})

/** 图表容器 DOM 引用 */
const chartRef = ref<HTMLDivElement>()
/** 图表实例，用普通变量保存以避免响应式开销 */
let chartInstance: EChartsType | null = null

/**
 * 初始化图表实例
 * 单独抽出后，便于在尺寸变化和组件重建时复用
 */
const initChart = async () => {
  await nextTick()
  if (!chartRef.value) return

  if (!chartInstance) {
    chartInstance = init(chartRef.value, undefined, { renderer: props.renderer })
    chartInstance.on('finished', () => {
      if (!chartRef.value) return
      chartRef.value.dataset.printChartReady = 'true'
      chartRef.value.dispatchEvent(new Event('print-chart-ready'))
    })
  }

  if (chartRef.value) chartRef.value.dataset.printChartReady = 'false'
  chartInstance.setOption(props.option, true)
}

// option 变化时更新图表；实例尚未创建则先初始化
watch(
  () => props.option,
  () => {
    if (!chartInstance) {
      initChart()
      return
    }
    if (chartRef.value) chartRef.value.dataset.printChartReady = 'false'
    chartInstance.setOption(props.option, true)
  },
  {
    deep: true
  }
)

watch(
  () => props.renderer,
  () => {
    chartInstance?.dispose()
    chartInstance = null
    initChart()
  }
)

// 容器尺寸变化时同步调整图表大小
useResizeObserver(chartRef, () => {
  chartInstance?.resize()
})

onMounted(() => {
  // 挂载后创建并渲染图表
  initChart()
})

onBeforeUnmount(() => {
  // 卸载前销毁实例，释放内存
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <!-- 图表渲染容器 -->
  <div ref="chartRef" class="app-echart" :style="{ height }"></div>
</template>

<style scoped lang="scss">
.app-echart {
  width: 100%;
  min-height: 0;
}
</style>
