<script setup lang="ts">
/** 座位表导出预览 — 按纸张比例渲染完整座位表，供导出前预览并暴露导出元素 */
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue'

import { PagesEnum } from '@/types/Common'
import {
  SeatingFirstColumnSideEnum,
  SeatingSpecialSeatPositionEnum,
  type SeatPositionType,
  type SeatingChartType
} from '@/types/SeatingChart'
import { buildSeatingChartPageLayout } from '@/utils/seating-chart/seatingChartPageLayoutUtil'
import { getSeatKey, getVisibleSeats } from '@/utils/seating-chart/seatingChartUtil'

import type { CSSProperties } from 'vue'
import type { SeatingChartPageOrientationType } from '@/utils/seating-chart/seatingChartPageLayoutUtil'

const props = withDefaults(
  defineProps<{
    /** 当前座位表 */
    chart: SeatingChartType
    /** 学生 ID 到姓名的映射 */
    studentNames: Record<string, string>
    /** 是否显示标题 */
    showTitle?: boolean
    /** 是否显示“空座位”标签 */
    showEmptyLabels: boolean
    /** 纸张类型 */
    pageType?: PagesEnum
    /** 页面方向 */
    orientation?: SeatingChartPageOrientationType
    /** 版面缩放百分比 */
    layoutScalePercent?: number
  }>(),
  {
    showTitle: true,
    pageType: PagesEnum.A4,
    orientation: 'landscape',
    layoutScalePercent: 100
  }
)

// 预览宿主元素与导出纸张元素；导出时对 exportElementRef 截图
const previewHostRef = shallowRef<HTMLElement | null>(null)
const exportElementRef = shallowRef<HTMLElement | null>(null)
const contentElementRef = shallowRef<HTMLElement | null>(null)
// 预览容器的尺寸
const previewWidth = shallowRef(0)
const previewHeight = shallowRef(0)
// 座位内容的自然尺寸，作为缩放计算基准
const naturalWidth = shallowRef(760)
const naturalHeight = shallowRef(540)
// 监听内容与容器尺寸变化的观察器
let contentResizeObserver: ResizeObserver | null = null

/** 当前纸张的页面布局尺寸 */
const pageLayout = computed(() =>
  buildSeatingChartPageLayout(props.chart, props.pageType, props.orientation, 1, props.showTitle)
)
/** 纸张原始像素尺寸 */
const paperStyle = computed<CSSProperties>(() => ({
  width: `${pageLayout.value.pageWidth}px`,
  height: `${pageLayout.value.pageHeight}px`
}))
/** 预览纸张相对预览容器的缩放比例，保证整张纸可见 */
const previewPaperScale = computed(() => {
  if (!previewWidth.value || !previewHeight.value) return 1
  return Math.min(
    (previewWidth.value - 8) / pageLayout.value.pageWidth,
    (previewHeight.value - 8) / pageLayout.value.pageHeight,
    1
  )
})
/** 预览舞台尺寸（缩放后的纸张尺寸） */
const previewStageStyle = computed<CSSProperties>(() => ({
  width: `${pageLayout.value.pageWidth * previewPaperScale.value}px`,
  height: `${pageLayout.value.pageHeight * previewPaperScale.value}px`
}))
/** 预览纸张的缩放变换 */
const previewPaperStyle = computed<CSSProperties>(() => ({
  transform: `scale(${previewPaperScale.value})`
}))
/** 纸张内边距占位，避开页边距区域 */
const contentViewportStyle = computed<CSSProperties>(() => ({
  inset: `${pageLayout.value.margin}px`
}))
/** 座位内容缩放：先适配可用区域，再乘以用户设置的版面缩放比例 */
const contentScale = computed(() => {
  const availableWidth = pageLayout.value.pageWidth - pageLayout.value.margin * 2
  const availableHeight = pageLayout.value.pageHeight - pageLayout.value.margin * 2
  const fitScale = Math.min(
    availableWidth / naturalWidth.value,
    availableHeight / naturalHeight.value
  )
  return fitScale * (props.layoutScalePercent / 100)
})
/** 座位内容的缩放变换，以内容中心为原点 */
const contentStyle = computed<CSSProperties>(() => ({
  transform: `translate(-50%, -50%) scale(${contentScale.value})`
}))
/** 第一列是否位于右侧 */
const firstColumnOnRight = computed(
  () => props.chart.firstColumnSide === SeatingFirstColumnSideEnum.Right
)
/** 将可见座位按行分组渲染 */
const visibleSeatRows = computed(() => {
  const rows: SeatPositionType[][] = []
  getVisibleSeats(props.chart).forEach((seat) => {
    const currentRow = rows[rows.length - 1]
    if (!currentRow || currentRow[0].row !== seat.row) rows.push([seat])
    else currentRow.push(seat)
  })
  return rows
})
/** 第一行的可见座位，用于渲染列头 */
const visibleColumnSeats = computed(() => visibleSeatRows.value[0] || [])
/** 当前启用的雅座 */
const enabledSpecialSeats = computed(() => props.chart.specialSeats.filter((seat) => seat.enabled))

/** 测量座位内容的自然尺寸，作为缩放计算基准 */
function measureContent(): void {
  if (!contentElementRef.value) return
  if (contentElementRef.value.offsetWidth > 0)
    naturalWidth.value = contentElementRef.value.offsetWidth
  if (contentElementRef.value.offsetHeight > 0) {
    naturalHeight.value = contentElementRef.value.offsetHeight
  }
}

/** 测量预览容器尺寸 */
function measurePreviewHost(): void {
  if (!previewHostRef.value) return
  previewWidth.value = previewHostRef.value.clientWidth
  previewHeight.value = previewHostRef.value.clientHeight
}

// 挂载后测量尺寸，并监听内容与容器尺寸变化以更新预览
onMounted(async () => {
  await nextTick()
  measureContent()
  measurePreviewHost()
  if (typeof ResizeObserver === 'undefined') return
  contentResizeObserver = new ResizeObserver(() => {
    measureContent()
    measurePreviewHost()
  })
  if (contentElementRef.value) contentResizeObserver.observe(contentElementRef.value)
  if (previewHostRef.value) contentResizeObserver.observe(previewHostRef.value)
})

// 卸载时断开尺寸观察器
onBeforeUnmount(() => contentResizeObserver?.disconnect())

/**
 * 判断座位后是否需要渲染过道。
 * @param seat - 座位位置
 */
function hasAisleAfterSeat(seat: SeatPositionType): boolean {
  // 第一列在右侧时，过道列索引需要反向换算
  const aisleColumn = firstColumnOnRight.value ? seat.column - 1 : seat.column
  return props.chart.aisleAfterColumns.includes(aisleColumn)
}

/**
 * 获取雅座上学生的姓名，空雅座返回空字符串。
 * @param position - 雅座位置
 */
function getSpecialSeatName(position: SeatingSpecialSeatPositionEnum): string {
  const seat = props.chart.specialSeats.find((item) => item.position === position)
  return seat?.studentId ? props.studentNames[seat.studentId] || '未命名学生' : ''
}

/**
 * 判断指定雅座是否启用。
 * @param position - 雅座位置
 */
function isSpecialSeatEnabled(position: SeatingSpecialSeatPositionEnum): boolean {
  return Boolean(props.chart.specialSeats.find((seat) => seat.position === position)?.enabled)
}

/** 暴露导出元素，供导出弹窗调用进行截图 */
function getElement(): HTMLElement | null {
  return exportElementRef.value
}

defineExpose({ getElement })
</script>

<template>
  <div ref="previewHostRef" class="seating-export-preview">
    <!-- 按容器缩放后的纸张舞台，保证整张纸可见 -->
    <div class="preview-paper-stage" :style="previewStageStyle">
      <div class="preview-paper-display" :style="previewPaperStyle">
        <article ref="exportElementRef" class="seating-export-sheet" :style="paperStyle">
          <div class="paper-content-viewport" :style="contentViewportStyle">
            <div ref="contentElementRef" class="seating-export-content" :style="contentStyle">
              <header v-if="showTitle" class="sheet-header">
                <h2>{{ chart.name }}</h2>
              </header>

              <!-- 教室平面图：讲台区 + 座位网格 -->
              <div class="classroom-plan">
                <div class="platform-area">
                  <div
                    v-if="isSpecialSeatEnabled(SeatingSpecialSeatPositionEnum.PlatformLeft)"
                    class="special-seat-slot special-seat-slot--left"
                  >
                    <div class="export-special-seat">
                      <small>讲台左侧</small>
                      <strong>{{
                        getSpecialSeatName(SeatingSpecialSeatPositionEnum.PlatformLeft) ||
                        (showEmptyLabels ? '空座位' : '')
                      }}</strong>
                    </div>
                  </div>
                  <div class="export-platform">讲 台</div>
                  <div
                    v-if="isSpecialSeatEnabled(SeatingSpecialSeatPositionEnum.PlatformRight)"
                    class="special-seat-slot special-seat-slot--right"
                  >
                    <div class="export-special-seat">
                      <small>讲台右侧</small>
                      <strong>{{
                        getSpecialSeatName(SeatingSpecialSeatPositionEnum.PlatformRight) ||
                        (showEmptyLabels ? '空座位' : '')
                      }}</strong>
                    </div>
                  </div>
                </div>

                <div class="seat-layout">
                  <div class="column-headers">
                    <span class="axis-corner"></span>
                    <template
                      v-for="seat in visibleColumnSeats"
                      :key="`export-column-${seat.column}`"
                    >
                      <span class="column-header">{{ seat.column + 1 }}<small>列</small></span>
                      <span v-if="hasAisleAfterSeat(seat)" class="aisle aisle--header"></span>
                    </template>
                  </div>

                  <div class="seat-rows">
                    <div v-for="row in visibleSeatRows" :key="row[0].row" class="seat-row">
                      <span class="row-header">{{ row[0].row + 1 }}<small>排</small></span>
                      <template v-for="seat in row" :key="getSeatKey(seat.row, seat.column)">
                        <div class="export-seat" :class="{ occupied: seat.studentId }">
                          <strong v-if="seat.studentId">
                            {{ studentNames[seat.studentId] || '未命名学生' }}
                          </strong>
                          <span v-else-if="showEmptyLabels">空座位</span>
                        </div>
                        <span v-if="hasAisleAfterSeat(seat)" class="aisle"></span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <footer class="sheet-footer">
                <span>共 {{ chart.seats.length + enabledSpecialSeats.length }} 个座位</span>
                <span>过道 {{ chart.aisleAfterColumns.length }} 处</span>
              </footer>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.seating-export-preview {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  overflow: hidden;
}

.preview-paper-stage {
  position: relative;
  flex: none;
}

.preview-paper-display {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

.seating-export-sheet {
  --ink: #29232e;
  --muted: #7a7180;
  --line: #d9d1dc;
  --paper: #fffefa;
  --accent: #5d3f7d;
  position: relative;
  box-sizing: border-box;
  flex: none;
  overflow: hidden;
  color: var(--ink);
  background:
    linear-gradient(rgba(117, 91, 75, 0.035) 1px, transparent 1px) 0 0/100% 28px,
    var(--paper);
  border: 1px solid #e7dfd5;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.paper-content-viewport {
  position: absolute;
  overflow: hidden;
}

.seating-export-content {
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  width: max-content;
  transform-origin: center;
}

.sheet-header,
.sheet-footer,
.platform-area,
.column-headers,
.seat-row {
  display: flex;
  align-items: center;
}

.sheet-header {
  justify-content: center;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--ink);
  text-align: center;
}

.sheet-header h2 {
  margin: 0;
  font-family: STKaiti, KaiTi, serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}

.classroom-plan {
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 28px 4px 24px;
}

.platform-area {
  justify-content: center;
  gap: 12px;
}

.special-seat-slot {
  width: 96px;
  min-width: 96px;
}

.export-platform {
  display: grid;
  width: 300px;
  height: 54px;
  box-sizing: border-box;
  place-content: center;
  color: #fff;
  background: var(--ink);
  border-radius: 4px;
  text-align: center;
}

.export-platform span {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
}

.export-platform small {
  margin-top: 2px;
  color: #d8cfdd;
  font-family: Georgia, serif;
  font-size: 7px;
  letter-spacing: 0.2em;
}

.export-special-seat {
  display: grid;
  width: 96px;
  min-height: 54px;
  box-sizing: border-box;
  place-content: center;
  padding: 7px;
  background: #fff9e9;
  border: 1px solid #cdbb88;
  border-radius: 4px;
  text-align: center;
}

.export-special-seat small {
  color: #927b4f;
  font-size: 8px;
}

.export-special-seat strong {
  margin-top: 3px;
  font-size: 12px;
}

.seat-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: max-content;
  margin: 0 auto;
}

.column-headers,
.seat-row {
  align-items: stretch;
  gap: 8px;
}

.axis-corner,
.row-header {
  width: 34px;
  min-width: 34px;
  box-sizing: border-box;
}

.column-header,
.row-header {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  color: #fff;
  background: var(--accent);
  border-radius: 3px;
  font-family: Georgia, serif;
  font-size: 14px;
  font-weight: 700;
}

.column-header {
  width: 88px;
  min-width: 88px;
  height: 28px;
}

.row-header {
  align-items: center;
  height: 52px;
}

.column-header small,
.row-header small {
  font-family: 'PingFang SC', sans-serif;
  font-size: 8px;
  font-weight: 500;
  opacity: 0.85;
}

.seat-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-seat {
  display: grid;
  width: 88px;
  min-width: 88px;
  height: 52px;
  box-sizing: border-box;
  place-content: center;
  padding: 6px;
  color: #aaa2aa;
  background: rgba(255, 255, 255, 0.82);
  border: 1px dashed var(--line);
  border-radius: 4px;
  font-size: 10px;
  text-align: center;
}

.export-seat.occupied {
  color: var(--ink);
  background: #fff;
  border: 1.5px solid #8c7b92;
}

.export-seat strong {
  max-width: 76px;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.25;
}

.aisle {
  width: 30px;
  min-width: 30px;
  box-sizing: border-box;
  background: repeating-linear-gradient(
    -45deg,
    rgba(93, 63, 125, 0.1) 0 5px,
    rgba(93, 63, 125, 0.025) 5px 10px
  );
  border-inline: 1px solid rgba(93, 63, 125, 0.16);
}

.aisle--header {
  background: transparent;
  border: 0;
}

.sheet-footer {
  justify-content: space-between;
  padding-top: 12px;
  color: var(--muted);
  border-top: 1px solid var(--line);
  font-size: 9px;
  letter-spacing: 0.06em;
}
</style>
