<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElScrollbar } from 'element-plus'

import EvaluationCard from '@/views/evaluation/components/EvaluationCard.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { mmToPixel, pageSizeInPixels } from '@/untils/pageSizeInPixelUntil'

const store = useDataSourceStore()
const { data: tableData } = storeToRefs(store)

const configurationStore = useConfigurationStore()
const { data: configuration } = storeToRefs(configurationStore)

const config = {
  width: 90,
  height: 69,
  margin: 12.7
}

const scrollbarRef = ref<InstanceType<typeof ElScrollbar>>()
const dataSource = ref<any[][]>([])
const pageInfo = reactive({
  pageWidth: 0,
  pageHeight: 0,
  cellWidth: 0,
  cellHeight: 0,
  columnCount: 0,
  margin: 0,
  cellLevel: 0
})

onMounted(() => {
  init()
})

// 监听数据变化，重新计算分组
watch(
  () => [tableData.value.length, configuration.value.pageType],
  () => {
    init()
  }
)

/**
 * 初始化布局计算
 * 核心逻辑：
 * 1. 将毫米单位的卡片尺寸转换为像素
 * 2. 根据页面类型（A3/A4/B3/B4）获取页面像素尺寸
 * 3. 计算每行可容纳的列数：可用宽度 / 卡片宽度
 * 4. 计算居中 margins：两侧留白相同保证卡片居中
 * 5. 计算每页可容纳的层数：页面高度 / 卡片高度
 * 6. 根据每页容量对数据进行分组
 */
const init = () => {
  const cellWidth = mmToPixel(config.width)
  const cellHeight = mmToPixel(config.height)
  pageInfo.cellWidth = cellWidth
  pageInfo.cellHeight = cellHeight

  const { width, height } = pageSizeInPixels(configuration.value.pageType)
  pageInfo.pageWidth = width
  pageInfo.pageHeight = height

  // 计算每行列数：可用宽度 / 卡片宽度（向下取整）
  const columnCount = Math.floor((width - config.margin * 2) / cellWidth)
  pageInfo.columnCount = columnCount

  // 计算居中 margins：总宽度 - 所有卡片宽度 = 剩余空间，两侧均分
  const margin = Math.floor((width - cellWidth * columnCount) / 2)
  pageInfo.margin = margin

  // 计算每页层数：页面高度 / 卡片高度，顶部预留一半 margin 空间
  pageInfo.cellLevel = Math.floor((height - margin / 2) / cellHeight)

  // 每页数据量 = 列数 × 层数，按此分组
  dataSource.value = groupArray(tableData.value, pageInfo.cellLevel * columnCount)
}

const groupArray = (array: any[], groupSize: number) => {
  let groups = []
  for (let i = 0; i < array.length; i += groupSize) {
    groups.push(array.slice(i, i + groupSize))
  }
  return groups
}

/**
 * 滚动到指定行
 * @param index 学生索引
 */
const scroll = (index: number) => {
  if (!scrollbarRef.value || !pageInfo.cellLevel || !pageInfo.columnCount) return
  if (index < 0 || index >= tableData.value.length) return

  const rowIndex = Math.floor((index - 1) / pageInfo.columnCount)
  const element = document.querySelectorAll('tr')[rowIndex]

  if (!element) return
  const container = scrollbarRef.value.wrapRef
  const elementRect = element.getBoundingClientRect()
  const containerRect = container!.getBoundingClientRect()
  const offsetTop = elementRect.top - containerRect?.top + container!.scrollTop

  scrollbarRef.value.scrollTo({
    top: offsetTop,
    behavior: 'smooth'
  })
}

defineExpose({ scroll })
</script>

<template>
  <el-scrollbar ref="scrollbarRef" always>
    <div class="evaluation-form-view__wrapper">
      <evaluation-card
        v-for="(data, index) in dataSource"
        :page-info="pageInfo"
        :data="data"
        :key="index"
      />
    </div>
  </el-scrollbar>
</template>

<style scoped lang="scss">
.evaluation-form-view__wrapper {
  height: 100%;
}
</style>
