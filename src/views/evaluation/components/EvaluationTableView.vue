<script setup lang="ts">
/**
 * 评语表格预览视图
 * 复用 PDF 布局做像素换算与分页分组，负责缩放适配与按学生滚动定位。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElScrollbar, ElEmpty } from 'element-plus'

import EvaluationPreviewCard from '@/views/evaluation/components/EvaluationCard.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { mmToPixelPrecise } from '@/utils/pageSizeInPixelUtil'
import { buildEvaluationPdfLayout } from '@/utils/evaluation/evaluationPdfLayoutUtil'
import { groupArray } from '@/utils/commonUtil'
import type { PreviewModeType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  activeStudentId?: string
  suppressActiveState?: boolean
  previewMode?: PreviewModeType
  students?: StudentDataType[]
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: '100'
})

const emit = defineEmits<{
  cardClick: [row: StudentDataType]
}>()

/** 将卡片点击事件透传给父组件 */
const handleCardClick = (row: StudentDataType) => {
  emit('cardClick', row)
}

const store = useDataSourceStore()
const { enabledData } = storeToRefs(store)
const tableData = computed(() => props.students ?? enabledData.value)

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

watch(
  () => [
    tableData.value,
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
 * 预览层直接复用导出 PDF 的毫米布局，只负责做像素换算和分页分组。
 * 这样页面上看到的纸张尺寸、单元格数量、边距与导出结果始终同源。
 */
const init = () => {
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

  dataSource.value = groupArray(tableData.value, layout.pageCapacity)
  updatePreviewScale()
}

const scaledPageWidth = computed(() => pageInfo.pageWidth * previewScale.value)
const scaledPageHeight = computed(() => pageInfo.pageHeight * previewScale.value)
const scaledPageOuterHeight = computed(() => (pageInfo.pageHeight + 24) * previewScale.value)

let resizeObserver: ResizeObserver | null = null

// “适应宽度”模式只按容器宽度缩放预览，不改内部原始布局尺寸。
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

// 监听容器尺寸变化，侧栏收展或窗口变化时重新计算缩放比例。
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
 * 根据学生索引滚动到其所在评语行。
 * 这里按表格行定位，所以索引换算依赖当前列数配置。
 */
const scroll = (studentId: string) => {
  if (!scrollbarRef.value || !pageInfo.cellLevel || !pageInfo.columnCount) return
  const index = tableData.value.findIndex((student) => student.studentId === studentId) + 1
  if (index < 1) return

  const rowIndex = Math.floor((index - 1) / pageInfo.columnCount)
  const element = stageRef.value?.querySelectorAll('tr')[rowIndex]

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
        <div
          class="preview-paper"
          :style="{ width: `${scaledPageWidth}px`, height: `${scaledPageHeight}px` }"
        >
          <div
            class="preview-paper__scale"
            :style="{
              width: `${pageInfo.pageWidth}px`,
              height: `${pageInfo.pageHeight}px`,
              transform: `scale(${previewScale})`
            }"
          >
            <evaluation-preview-card
              :page-info="pageInfo"
              :data="data"
              :current-page="index + 1"
              :total-pages="dataSource.length"
              :active-student-id="props.activeStudentId"
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
  display: flex;
  justify-content: center;
}

.preview-paper {
  position: relative;
  margin: 0 auto;
}

.preview-paper__scale {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}
</style>
