<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElScrollbar, ElEmpty } from 'element-plus'

import EvaluationCard from '@/views/evaluation/components/EvaluationCard.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { mmToPixelPrecise } from '@/utils/pageSizeInPixelUntil'
import { buildEvaluationPdfLayout } from '@/utils/evaluationPdfLayoutUntil'
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
 * 1. 统一复用导出 PDF 的毫米布局规则
 * 2. 仅在预览层做毫米到像素的精确换算
 * 3. 确保预览分页、页面大小、评语块大小和导出同源
 */
const init = () => {
  // 预览与导出共用同一套毫米布局，避免“页面看着对，导出尺寸却不一致”。
  const layout = buildEvaluationPdfLayout(configurationStore)

  pageInfo.pageWidth = mmToPixelPrecise(layout.pageWidth)
  pageInfo.pageHeight = mmToPixelPrecise(layout.pageHeight)
  pageInfo.cellWidth = mmToPixelPrecise(layout.cellWidth)
  pageInfo.cellHeight = mmToPixelPrecise(layout.cellHeight)
  pageInfo.columnCount = layout.columnCount
  pageInfo.marginX = mmToPixelPrecise(layout.marginX)
  pageInfo.marginY = mmToPixelPrecise(layout.marginY)
  pageInfo.tableWidth = mmToPixelPrecise(layout.tableWidth)
  pageInfo.tableOffsetX = mmToPixelPrecise(layout.tableOffsetX)
  pageInfo.cellLevel = layout.rowCount

  // 每页数据量 = 列数 × 层数，按此分组
  dataSource.value = groupArray(tableData.value, layout.pageCapacity)
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
          <div
            class="preview-paper__scale"
            :style="{
              width: `${pageInfo.pageWidth}px`,
              height: `${pageInfo.pageHeight}px`,
              transform: `scale(${previewScale})`
            }"
          >
            <evaluation-card
              :page-info="pageInfo"
              :data="data"
              :current-page="index + 1"
              :total-pages="dataSource.length"
              :active-student-name="props.activeStudentName"
              :suppress-active-state="props.suppressActiveState"
              @click="handleCardClick"
            />
          </div>
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped lang="scss">
.evaluation-form-view__wrapper {
  min-height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at top, rgba(148, 163, 184, 0.08), transparent 32%),
    linear-gradient(180deg, #f7fafc 0%, #eef3f8 100%);
}

.preview-stage {
  width: 100%;
  padding-bottom: 18px;
  box-sizing: border-box;
  overflow: hidden;
}

.preview-paper {
  position: relative;
  margin: 0 auto;
  overflow: hidden;
}

.preview-paper__scale {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

:deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}
</style>
