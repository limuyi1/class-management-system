<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElScrollbar, ElEmpty } from 'element-plus'

import EvaluationCard from '@/views/evaluation/components/EvaluationCard.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { mmToPixel, pageSizeInPixels } from '@/utils/pageSizeInPixelUntil'
import { groupArray } from '@/utils/commonUntil'
import type { PreviewModeType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  activeStudentName?: string
  suppressActiveState?: boolean
  previewMode?: PreviewModeType
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: '100'
})

/**
 * 点击评语卡片回调
 * 通知父组件激活对应学生的评语编辑
 */
const emit = defineEmits<{
  cardClick: [row: StudentDataType]
}>()

/**
 * 处理卡片点击事件
 * @param row - 被点击的学生行数据
 */
const handleCardClick = (row: StudentDataType) => {
  emit('cardClick', row)
}

const store = useDataSourceStore()
const { enabledData: tableData } = storeToRefs(store)

const configurationStore = useConfigurationStore()

const scrollbarRef = ref<InstanceType<typeof ElScrollbar>>()
const stageRef = ref<HTMLDivElement | null>(null)
const dataSource = ref<StudentDataType[][]>([])
const previewScale = ref(1)
const pageInfo = reactive({
  pageWidth: 0,
  pageHeight: 0,
  cellWidth: 0,
  cellHeight: 0,
  columnCount: 0,
  marginX: 0,
  marginY: 0,
  tableWidth: 0,
  tableOffsetX: 0,
  cellLevel: 0
})

onMounted(() => {
  init()
  bindResizeObserver()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

// 监听数据变化，重新计算分组
watch(
  () => [
    tableData.value.length,
    configurationStore.pageType,
    configurationStore.evaluationCardWidth,
    configurationStore.evaluationCardHeight,
    configurationStore.marginX,
    configurationStore.marginY,
    configurationStore.evaluationTableAlign,
    props.previewMode
  ],
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
  const cellWidth = mmToPixel(configurationStore.evaluationCardWidth)
  const cellHeight = mmToPixel(configurationStore.evaluationCardHeight)
  pageInfo.cellWidth = cellWidth
  pageInfo.cellHeight = cellHeight

  const { width, height } = pageSizeInPixels(configurationStore.pageType)
  pageInfo.pageWidth = width
  pageInfo.pageHeight = height

  const marginX = mmToPixel(configurationStore.marginX)
  const marginY = mmToPixel(configurationStore.marginY)
  pageInfo.marginX = marginX
  pageInfo.marginY = marginY

  // 统一按 A4 基准边距计算可用宽度，避免 B3/B4 因纸张变大出现额外边距漂移
  const availableWidth = Math.max(width - marginX * 2, cellWidth)
  const columnCount = Math.max(1, Math.floor(availableWidth / cellWidth))
  pageInfo.columnCount = columnCount
  pageInfo.tableWidth = cellWidth * columnCount
  const extraSpace = Math.max(availableWidth - pageInfo.tableWidth, 0)
  if (configurationStore.evaluationTableAlign === 'center') {
    pageInfo.tableOffsetX = Math.floor(extraSpace / 2)
  } else if (configurationStore.evaluationTableAlign === 'right') {
    pageInfo.tableOffsetX = extraSpace
  } else {
    pageInfo.tableOffsetX = 0
  }

  const availableHeight = Math.max(height - marginY * 2, cellHeight)
  pageInfo.cellLevel = Math.max(1, Math.floor(availableHeight / cellHeight))

  // 每页数据量 = 列数 × 层数，按此分组
  dataSource.value = groupArray(tableData.value, pageInfo.cellLevel * columnCount)
  updatePreviewScale()
}

const scaledPageWidth = computed(() => pageInfo.pageWidth * previewScale.value)
const scaledPageHeight = computed(() => pageInfo.pageHeight * previewScale.value)
const scaledPageOuterHeight = computed(() => (pageInfo.pageHeight + 24) * previewScale.value)

let resizeObserver: ResizeObserver | null = null

const updatePreviewScale = () => {
  const container = scrollbarRef.value?.wrapRef || stageRef.value
  if (!container || !pageInfo.pageWidth) return

  if (props.previewMode !== 'fit') {
    previewScale.value = Number(props.previewMode) / 100
    return
  }

  const availableWidth = Math.max(container.clientWidth - 24, 0)
  if (!availableWidth) return

  previewScale.value = availableWidth / pageInfo.pageWidth
}

const bindResizeObserver = () => {
  const container = scrollbarRef.value?.wrapRef || stageRef.value
  if (!container || typeof ResizeObserver === 'undefined') return

  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => {
    updatePreviewScale()
  })
  resizeObserver.observe(container)
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
  <el-scrollbar ref="scrollbarRef">
    <div ref="stageRef" class="evaluation-form-view__wrapper">
      <el-empty v-if="dataSource.length === 0" description="暂无学生数据" />
      <div
        v-for="(data, index) in dataSource"
        v-else
        :key="index"
        class="preview-stage"
        :style="{
          height: `${scaledPageOuterHeight}px`
        }"
      >
        <div class="preview-paper" :style="{ width: `${scaledPageWidth}px`, height: `${scaledPageHeight}px` }">
          <evaluation-card
            :page-info="pageInfo"
            :data="data"
            :current-page="index + 1"
            :total-pages="dataSource.length"
            :active-student-name="props.activeStudentName"
            :suppress-active-state="props.suppressActiveState"
            :style="{
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left'
            }"
            @click="handleCardClick"
          />
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped lang="scss">
.evaluation-form-view__wrapper {
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at top, rgba(148, 163, 184, 0.08), transparent 32%),
    linear-gradient(180deg, #f7fafc 0%, #eef3f8 100%);
}

.preview-stage {
  width: 100%;
  margin-bottom: 18px;
  box-sizing: border-box;
}

.preview-paper {
  position: relative;
  margin: 0 auto;
}
</style>
