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

const init = () => {
  const cellWidth = mmToPixel(config.width)
  const cellHeight = mmToPixel(config.height)
  pageInfo.cellWidth = cellWidth
  pageInfo.cellHeight = cellHeight

  // 根据下拉选择的类型，获取页面尺寸
  const { width, height } = pageSizeInPixels(configuration.value.pageType)
  pageInfo.pageWidth = width
  pageInfo.pageHeight = height

  // 先按照默认最小的margin计算出每行的列数
  const columnCount = Math.floor((width - config.margin * 2) / cellWidth)
  pageInfo.columnCount = columnCount

  // 算出真实的margin值
  const margin = Math.floor((width - cellWidth * columnCount) / 2)
  pageInfo.margin = margin

  // 每页的层数
  pageInfo.cellLevel = Math.floor((height - margin / 2) / cellHeight)

  // 每页的数据进行分组
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
