<script setup lang="ts">
/** 值日表导出预览 — 按纸张比例渲染完整值日表，供导出前预览并暴露导出元素 */
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue'

import { PagesEnum } from '@/types/Common'
import { DutyPeriodEnum, DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { buildDutyRosterPageLayout } from '@/utils/duty-roster/dutyRosterPageLayoutUtil'
import { DUTY_PERIOD_LABELS, getDutyAssignment, getDutyPeriods } from '@/utils/duty-roster/dutyRosterUtil'

import type { CSSProperties } from 'vue'

const props = withDefaults(
  defineProps<{
    roster: DutyRosterType
    studentNames: Record<string, string>
    pageType?: PagesEnum
    showTitle?: boolean
    showNotes?: boolean
    layoutScalePercent?: number
  }>(),
  {
    pageType: PagesEnum.A4,
    showTitle: true,
    showNotes: true,
    layoutScalePercent: 100
  }
)

// 预览容器、导出纸张与导出内容元素引用
const previewHostRef = shallowRef<HTMLElement | null>(null)
const exportElementRef = shallowRef<HTMLElement | null>(null)
const contentElementRef = shallowRef<HTMLElement | null>(null)
// 预览容器尺寸
const previewWidth = shallowRef(0)
const previewHeight = shallowRef(0)
// 导出内容自然尺寸，作为内容缩放计算基准
const naturalWidth = shallowRef(860)
const naturalHeight = shallowRef(500)
/** 自动适配时为内容外框预留的总缓冲，避免缩放后边框落在裁切边缘 */
const CONTENT_FIT_GUTTER = 8
// 尺寸变化观察器
let resizeObserver: ResizeObserver | null = null

/** 当前纸张的页面布局尺寸 */
const pageLayout = computed(() =>
  buildDutyRosterPageLayout(props.roster, props.pageType, 1, props.showTitle, props.showNotes)
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
/** 内容缩放：先适配可用区域，再乘以用户设置的版面缩放比例 */
const contentScale = computed(() => {
  const availableWidth =
    pageLayout.value.pageWidth - pageLayout.value.margin * 2 - CONTENT_FIT_GUTTER
  const availableHeight =
    pageLayout.value.pageHeight - pageLayout.value.margin * 2 - CONTENT_FIT_GUTTER
  const fitScale = Math.min(
    availableWidth / naturalWidth.value,
    availableHeight / naturalHeight.value
  )
  return fitScale * (props.layoutScalePercent / 100)
})
/** 内容的缩放变换，以内容中心为原点 */
const contentStyle = computed<CSSProperties>(() => ({
  transform: `translate(-50%, -50%) scale(${contentScale.value})`
}))
/** 按排序整理后的区域与岗位列表 */
const sections = computed(() =>
  [...props.roster.sections]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((section) => ({
      ...section,
      positions: [...section.positions].sort((left, right) => left.sortOrder - right.sortOrder)
    }))
)
/** 是否为“每组一天”模式 */
const isDaily = computed(() => props.roster.mode === DutyRosterModeEnum.Daily)
/** 矩阵数据行：每日模式按时段，周模式按自定义行 */
const rows = computed(() => {
  if (isDaily.value) {
    return getDutyPeriods(props.roster.mode).map((period) => ({
      key: period,
      period,
      rowId: undefined
    }))
  }
  return [...(props.roster.weeklyRows || [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((row) => ({ key: row.id, period: DutyPeriodEnum.Weekly, rowId: row.id }))
})
/** 各岗位打印列宽，保证同一岗位的姓名可使用顿号单行展示 */
const positionWidths = computed<Record<string, number>>(() => {
  const widths = Object.fromEntries(
    sections.value.flatMap((section) => section.positions.map((position) => [position.id, 94]))
  )

  props.roster.assignments.forEach((assignment) => {
    const studentLine = assignment.studentIds
      .map((studentId) => props.studentNames[studentId] || '未知学生')
      .join('、')
    const estimatedWidth =
      Array.from(studentLine).reduce(
        (width, character) => width + ((character.codePointAt(0) ?? 0) <= 0xff ? 8 : 14),
        30
      )
    widths[assignment.positionId] = Math.max(widths[assignment.positionId] || 94, estimatedWidth)
  })

  return widths
})
/** 打印表格宽度，姓名较多时扩展岗位列并由单页布局统一缩放 */
const tableWidth = computed(() =>
  Math.max(
    520,
    sections.value.reduce(
      (width, section) =>
        width +
        section.positions.reduce(
          (sectionWidth, position) => sectionWidth + positionWidths.value[position.id],
          0
        ),
      isDaily.value ? 64 : 0
    )
  )
)
const tableStyle = computed<CSSProperties>(() => ({
  width: `${tableWidth.value}px`
}))
/** 过滤掉空行的备注说明 */
const noteLines = computed(() => props.roster.notes.split('\n').filter((line) => line.trim()))

/**
 * 获取指定岗位与时段下的学生 ID 列表。
 * @param period - 时段
 * @param positionId - 岗位 ID
 * @param rowId - 周模式下的行 ID
 */
function getStudentIds(period: DutyPeriodEnum, positionId: string, rowId?: string): string[] {
  return getDutyAssignment(props.roster.assignments, period, positionId, rowId)?.studentIds || []
}

/** 获取岗位打印列宽 */
function getPositionColumnStyle(positionId: string): CSSProperties {
  return { width: `${positionWidths.value[positionId] || 94}px` }
}

/**
 * 判断学生是否为组长。
 * @param studentId - 学生 ID
 */
function isLeader(studentId: string): boolean {
  return props.roster.leaders.some((leader) => leader.studentId === studentId)
}

/** 测量内容自然尺寸，作为缩放计算基准 */
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

onMounted(async () => {
  await nextTick()
  measureContent()
  measurePreviewHost()
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    measureContent()
    measurePreviewHost()
  })
  if (contentElementRef.value) resizeObserver.observe(contentElementRef.value)
  if (previewHostRef.value) resizeObserver.observe(previewHostRef.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

/** 暴露导出元素，供导出弹窗调用进行截图 */
function getElement(): HTMLElement | null {
  return exportElementRef.value
}

defineExpose({ getElement })
</script>

<template>
  <div ref="previewHostRef" class="duty-print-preview">
    <div class="duty-preview-stage" :style="previewStageStyle">
      <div class="duty-preview-display" :style="previewPaperStyle">
        <article ref="exportElementRef" class="duty-print-sheet" :style="paperStyle">
          <div class="duty-content-viewport" :style="contentViewportStyle">
            <div ref="contentElementRef" class="duty-export-content" :style="contentStyle">
              <header v-if="showTitle" class="duty-sheet-header">
                <h2>{{ roster.name }}</h2>
              </header>

              <table class="duty-print-table" :class="{ 'is-daily': isDaily }" :style="tableStyle">
                <colgroup>
                  <col v-if="isDaily" class="duty-print-table__period-column" />
                  <template v-for="section in sections" :key="section.id">
                    <col
                      v-for="position in section.positions"
                      :key="position.id"
                      class="duty-print-table__position-column"
                      :style="getPositionColumnStyle(position.id)"
                    />
                  </template>
                </colgroup>
                <thead>
                  <tr class="duty-print-table__section-row">
                    <th v-if="isDaily" class="duty-print-table__period" rowspan="2">星期</th>
                    <th
                      v-for="section in sections"
                      :key="section.id"
                      :colspan="section.positions.length"
                    >
                      {{ section.name }}
                    </th>
                  </tr>
                  <tr class="duty-print-table__position-row">
                    <template v-for="section in sections" :key="section.id">
                      <th v-for="position in section.positions" :key="position.id">
                        {{ position.name }}
                      </th>
                    </template>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.key">
                    <th v-if="isDaily" class="duty-print-table__period">
                      {{ DUTY_PERIOD_LABELS[row.period] }}
                    </th>
                    <template v-for="section in sections" :key="`${row.key}-${section.id}`">
                      <td v-for="position in section.positions" :key="`${row.key}-${position.id}`">
                        <span class="duty-print-table__student-list">
                          <template
                            v-for="(studentId, index) in getStudentIds(
                              row.period,
                              position.id,
                              row.rowId
                            )"
                            :key="studentId"
                          >
                            <span
                              class="duty-print-table__student"
                              :class="{ 'is-leader': isLeader(studentId) }"
                            >
                              {{ studentNames[studentId] || '未知学生' }}
                            </span>
                            <span
                              v-if="
                                index <
                                getStudentIds(row.period, position.id, row.rowId).length - 1
                              "
                              class="duty-print-table__separator"
                            >、</span>
                          </template>
                        </span>
                      </td>
                    </template>
                  </tr>
                </tbody>
              </table>

              <section
                v-if="showNotes && noteLines.length"
                class="duty-print-notes"
                :style="tableStyle"
              >
                <h3>备注说明</h3>
                <div class="duty-print-notes__content">
                  <p v-for="(line, index) in noteLines" :key="`${index}-${line}`">
                    {{ line }}
                  </p>
                </div>
              </section>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.duty-print-preview {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  place-items: center;
}

.duty-preview-stage {
  position: relative;
  flex: none;
}

.duty-preview-display {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

.duty-print-sheet {
  --duty-ink: #22272e;
  --duty-muted: #525a63;
  --duty-line: #7d8791;
  --duty-paper: #fff;
  --duty-accent: #d93643;
  position: relative;
  box-sizing: border-box;
  flex: none;
  overflow: hidden;
  color: var(--duty-ink);
  background: var(--duty-paper);
  border: 1px solid #d8d8d8;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.duty-content-viewport {
  position: absolute;
  overflow: hidden;
}

.duty-export-content {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  width: max-content;
  box-sizing: border-box;
  flex-direction: column;
  transform-origin: center;
}

.duty-sheet-header {
  display: flex;
  justify-content: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #aeb5bc;
  text-align: center;
}

.duty-sheet-header h2 {
  max-width: 820px;
  margin: 0;
  font-family: STKaiti, KaiTi, serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}

.duty-print-table {
  margin-top: 20px;
  border: 1px solid var(--duty-line);
  border-spacing: 0;
  border-collapse: separate;
  border-radius: 0;
  table-layout: fixed;
  font-size: 12px;
}

.duty-print-table__period-column {
  width: 64px;
}

.duty-print-table__position-column {
  width: 94px;
}

.duty-print-table th,
.duty-print-table td {
  box-sizing: border-box;
  border: 0;
  border-right: 1px solid var(--duty-line);
  border-bottom: 1px solid var(--duty-line);
  text-align: center;
}

.duty-print-table tr > :last-child {
  border-right: 0;
}

.duty-print-table tbody tr:last-child > * {
  border-bottom: 0;
}

.duty-print-table__section-row th {
  height: 36px;
  padding: 7px 6px;
  color: var(--duty-ink);
  background: #e1e6eb;
  border-color: var(--duty-line);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.duty-print-table__position-row th {
  height: 38px;
  padding: 7px 6px;
  color: var(--duty-ink);
  background: #f1f3f5;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.duty-print-table__period {
  color: var(--duty-ink);
  background: #e9edf1 !important;
  border-color: var(--duty-line) !important;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.duty-print-table tbody td {
  height: 62px;
  padding: 9px 7px;
  background: #fff;
  vertical-align: middle;
}

.duty-print-table tbody tr:nth-child(even) td {
  background: #fafbfc;
}

.duty-print-table__student-list {
  display: inline-block;
  white-space: nowrap;
}

.duty-print-table__student {
  display: inline;
  color: var(--duty-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.duty-print-table__student.is-leader {
  color: #d93643;
  font-weight: 750;
}

.duty-print-table__separator {
  color: var(--duty-ink);
  font-size: 13px;
  font-weight: 500;
}

.duty-print-notes {
  display: grid;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  grid-template-columns: 72px minmax(0, 1fr);
  margin-top: 16px;
  padding: 10px 12px;
  color: var(--duty-ink);
  border-top: 1px solid var(--duty-line);
  background: #fafbfc;
}

.duty-print-notes h3 {
  margin: 0;
  color: var(--duty-ink);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
  letter-spacing: 0.03em;
}

.duty-print-notes__content {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.duty-print-notes p {
  min-width: 0;
  margin: 0;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
