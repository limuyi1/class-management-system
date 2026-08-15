<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue'

import { PagesEnum } from '@/types/Common'
import { DutyPeriodEnum, DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { buildDutyRosterPageLayout } from '@/utils/dutyRosterPageLayoutUtil'
import { DUTY_PERIOD_LABELS, getDutyAssignment, getDutyPeriods } from '@/utils/dutyRosterUtil'

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

const previewHostRef = shallowRef<HTMLElement | null>(null)
const exportElementRef = shallowRef<HTMLElement | null>(null)
const contentElementRef = shallowRef<HTMLElement | null>(null)
const previewWidth = shallowRef(0)
const previewHeight = shallowRef(0)
const naturalWidth = shallowRef(860)
const naturalHeight = shallowRef(500)
let resizeObserver: ResizeObserver | null = null

const pageLayout = computed(() =>
  buildDutyRosterPageLayout(props.roster, props.pageType, 1, props.showTitle, props.showNotes)
)
const paperStyle = computed<CSSProperties>(() => ({
  width: `${pageLayout.value.pageWidth}px`,
  height: `${pageLayout.value.pageHeight}px`
}))
const previewPaperScale = computed(() => {
  if (!previewWidth.value || !previewHeight.value) return 1
  return Math.min(
    (previewWidth.value - 8) / pageLayout.value.pageWidth,
    (previewHeight.value - 8) / pageLayout.value.pageHeight,
    1
  )
})
const previewStageStyle = computed<CSSProperties>(() => ({
  width: `${pageLayout.value.pageWidth * previewPaperScale.value}px`,
  height: `${pageLayout.value.pageHeight * previewPaperScale.value}px`
}))
const previewPaperStyle = computed<CSSProperties>(() => ({
  transform: `scale(${previewPaperScale.value})`
}))
const contentViewportStyle = computed<CSSProperties>(() => ({
  inset: `${pageLayout.value.margin}px`
}))
const contentScale = computed(() => {
  const availableWidth = pageLayout.value.pageWidth - pageLayout.value.margin * 2
  const availableHeight = pageLayout.value.pageHeight - pageLayout.value.margin * 2
  const fitScale = Math.min(
    availableWidth / naturalWidth.value,
    availableHeight / naturalHeight.value
  )
  return fitScale * (props.layoutScalePercent / 100)
})
const contentStyle = computed<CSSProperties>(() => ({
  transform: `translate(-50%, -50%) scale(${contentScale.value})`
}))
const sections = computed(() =>
  [...props.roster.sections]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((section) => ({
      ...section,
      positions: [...section.positions].sort((left, right) => left.sortOrder - right.sortOrder)
    }))
)
const isDaily = computed(() => props.roster.mode === DutyRosterModeEnum.Daily)
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
const positionCount = computed(() =>
  sections.value.reduce((count, section) => count + section.positions.length, 0)
)
const tableStyle = computed<CSSProperties>(() => ({
  width: `${Math.max(520, positionCount.value * 94 + (isDaily.value ? 64 : 0))}px`
}))
const noteLines = computed(() => props.roster.notes.split('\n').filter((line) => line.trim()))

function getStudentIds(period: DutyPeriodEnum, positionId: string, rowId?: string): string[] {
  return getDutyAssignment(props.roster.assignments, period, positionId, rowId)?.studentIds || []
}

function isLeader(studentId: string): boolean {
  return props.roster.leaders.some((leader) => leader.studentId === studentId)
}

function measureContent(): void {
  if (!contentElementRef.value) return
  if (contentElementRef.value.offsetWidth > 0)
    naturalWidth.value = contentElementRef.value.offsetWidth
  if (contentElementRef.value.offsetHeight > 0) {
    naturalHeight.value = contentElementRef.value.offsetHeight
  }
}

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
                        <span
                          v-for="studentId in getStudentIds(row.period, position.id, row.rowId)"
                          :key="studentId"
                          class="duty-print-table__student"
                          :class="{ 'is-leader': isLeader(studentId) }"
                        >
                          <font-awesome-icon
                            v-if="isLeader(studentId)"
                            :icon="['solid', 'circle']"
                          />
                          {{ studentNames[studentId] || '未知学生' }}
                        </span>
                      </td>
                    </template>
                  </tr>
                </tbody>
              </table>

              <section v-if="showNotes && noteLines.length" class="duty-print-notes">
                <h3>备注说明</h3>
                <div class="duty-print-notes__content">
                  <p v-for="(line, index) in noteLines" :key="`${index}-${line}`">
                    <font-awesome-icon v-if="index === 0" :icon="['solid', 'circle']" />
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
  --duty-ink: #29232e;
  --duty-muted: #776e7c;
  --duty-line: #d7ceda;
  --duty-paper: #fffefa;
  --duty-accent: #5d3f7d;
  position: relative;
  box-sizing: border-box;
  flex: none;
  overflow: hidden;
  color: var(--duty-ink);
  background:
    linear-gradient(rgba(117, 91, 75, 0.035) 1px, transparent 1px) 0 0/100% 28px,
    var(--duty-paper);
  border: 1px solid #e7dfd5;
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
  padding-bottom: 18px;
  border-bottom: 2px solid var(--duty-ink);
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
  margin-top: 24px;
  overflow: hidden;
  border: 1.5px solid var(--duty-ink);
  border-spacing: 0;
  border-collapse: separate;
  border-radius: 4px;
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
  height: 34px;
  padding: 6px 5px;
  color: #fff;
  background: var(--duty-ink);
  border-color: #514a55;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.duty-print-table__position-row th {
  height: 36px;
  padding: 6px 5px;
  color: #4f3b67;
  background: #eee8f3;
  font-size: 11px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.duty-print-table__period {
  color: #fff;
  background: var(--duty-accent) !important;
  border-color: #745d8e !important;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.duty-print-table tbody td {
  height: 62px;
  padding: 8px 6px;
  background: rgba(255, 255, 255, 0.82);
  vertical-align: middle;
}

.duty-print-table tbody tr:nth-child(even) td {
  background: rgba(249, 247, 250, 0.88);
}

.duty-print-table__student {
  display: block;
  margin: 2px 0;
  color: var(--duty-ink);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.duty-print-table__student.is-leader {
  color: #d93643;
  font-weight: 750;
}

.duty-print-table__student svg,
.duty-print-notes svg {
  margin-right: 3px;
  color: #d93643;
  font-size: 5px;
  vertical-align: middle;
}

.duty-print-notes {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  margin-top: 20px;
  padding-top: 12px;
  color: var(--duty-muted);
  border-top: 1px solid var(--duty-line);
}

.duty-print-notes h3 {
  margin: 0;
  color: var(--duty-ink);
  font-family: STKaiti, KaiTi, serif;
  font-size: 14px;
  letter-spacing: 0.08em;
}

.duty-print-notes__content {
  display: grid;
  gap: 3px;
}

.duty-print-notes p {
  margin: 0;
  font-size: 10px;
  line-height: 1.45;
}
</style>
