<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import StudentSourceSelector from '@/components/student-source/StudentSourceSelector.vue'
import { useDataSourceStore } from '@/stores/data-source'
import { useSeatingChartStore } from '@/stores/seating-chart'
import RandomModeDialog from '@/views/seating-chart/components/RandomModeDialog.vue'
import RandomSupplementPreviewDialog from '@/views/seating-chart/components/RandomSupplementPreviewDialog.vue'
import SeatingChartCanvas from '@/views/seating-chart/components/SeatingChartCanvas.vue'
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'
import SeatingChartExportDialog from '@/views/seating-chart/components/SeatingChartExportDialog.vue'
import SeatingChartToolbar from '@/views/seating-chart/components/SeatingChartToolbar.vue'
import SeatingStudentImportDialog from '@/views/seating-chart/components/SeatingStudentImportDialog.vue'
import SpecialSeatSettingsDialog from '@/views/seating-chart/components/SpecialSeatSettingsDialog.vue'
import UnassignedStudentPanel from '@/views/seating-chart/components/UnassignedStudentPanel.vue'
import {
  SeatingSpecialSeatPositionEnum,
  SeatingViewDirectionEnum,
  type SeatingChartPreviewType,
  type SeatingSpecialSeatType,
  type SeatPositionType
} from '@/types/SeatingChart'
import {
  createRandomSeats,
  getResizeAffectedCount,
  getVisibleSeats,
  SEATING_CHART_MAX_SIZE,
  SEATING_CHART_MIN_SIZE
} from '@/utils/seatingChartUntil'

import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

const router = useRouter()
const seatingStore = useSeatingChartStore()
const dataSourceStore = useDataSourceStore()
const { activeStudents, editingChart, unassignedStudents, assignedCount, seatCapacity } =
  storeToRefs(seatingStore)
const fullscreen = shallowRef(false)
const draggedStudentId = ref<string | null>(null)
const selectedStudentId = ref<string | null>(null)
const layoutVisible = ref(false)
const aisleVisible = ref(false)
const randomModeVisible = ref(false)
const previewVisible = ref(false)
const specialSeatVisible = ref(false)
const exportVisible = shallowRef(false)
const studentImportVisible = shallowRef(false)
const pendingExcelCreate = shallowRef(false)
const pendingCreateLayout = ref({ rows: 6, columns: 6 })
const layout = ref({ rows: 6, columns: 6 })
const initialLayout = ref({ rows: 6, columns: 6 })
const aisles = ref<number[]>([])
const preview = ref<SeatingChartPreviewType | null>(null)

const studentNames = computed(
  () => new Map(activeStudents.value.map((student) => [student.id, student.name]))
)
const studentNameRecord = computed<Record<string, string>>(() =>
  Object.fromEntries(studentNames.value)
)
const visibleSeats = computed(() => (editingChart.value ? getVisibleSeats(editingChart.value) : []))
const visibleSeatRows = computed(() => {
  const rows: SeatPositionType[][] = []
  visibleSeats.value.forEach((seat) => {
    const currentRow = rows[rows.length - 1]
    if (!currentRow || currentRow[0].row !== seat.row) rows.push([seat])
    else currentRow.push(seat)
  })
  return rows
})

watch(
  () => dataSourceStore.enabledData.map((student) => student.studentId).join(','),
  () => seatingStore.reconcileStudents()
)

onMounted(() => {
  seatingStore.reconcileStudents()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function backToTools(): void {
  router.push('/tools')
}
function createChart(): void {
  if (dataSourceStore.enabledData.length) {
    seatingStore.createChart({ studentSource: 'system' })
    return
  }
  pendingExcelCreate.value = true
  pendingCreateLayout.value = { rows: 6, columns: 6 }
  studentImportVisible.value = true
}
function createInitialChart(): void {
  if (dataSourceStore.enabledData.length) {
    seatingStore.createChart({
      studentSource: 'system',
      rows: initialLayout.value.rows,
      columns: initialLayout.value.columns
    })
    return
  }
  pendingExcelCreate.value = true
  pendingCreateLayout.value = { ...initialLayout.value }
  studentImportVisible.value = true
}

async function confirmClearAssignments(): Promise<boolean> {
  if (!assignedCount.value) return true
  try {
    await ElMessageBox.confirm('更换学生来源后，当前座位安排将被清空。是否继续？', '更换数据来源', {
      type: 'warning'
    })
    return true
  } catch {
    return false
  }
}

async function handleStudentSourceChange(source: StudentSourceType): Promise<void> {
  if (!editingChart.value || source === editingChart.value.studentSource) return
  if (!(await confirmClearAssignments())) return

  if (source === 'excel') {
    if (!editingChart.value.excelSource) {
      pendingExcelCreate.value = false
      studentImportVisible.value = true
      return
    }
    seatingStore.setStudentSource('excel', editingChart.value.excelSource)
    return
  }
  seatingStore.setStudentSource('system')
}

async function openStudentImport(): Promise<void> {
  if (editingChart.value && !(await confirmClearAssignments())) return
  pendingExcelCreate.value = !editingChart.value
  pendingCreateLayout.value = editingChart.value
    ? { rows: editingChart.value.rows, columns: editingChart.value.columns }
    : { ...initialLayout.value }
  studentImportVisible.value = true
}

function handleExcelStudentImport(source: ExcelStudentSourceType): void {
  if (pendingExcelCreate.value || !editingChart.value) {
    seatingStore.createChart({
      studentSource: 'excel',
      excelSource: source,
      rows: pendingCreateLayout.value.rows,
      columns: pendingCreateLayout.value.columns
    })
  } else {
    seatingStore.setStudentSource('excel', source)
  }
  pendingExcelCreate.value = false
  ElMessage.success(`已导入 ${source.students.length} 名学生`)
}
function selectChart(chartId: string): void {
  seatingStore.setEditingChart(chartId)
  selectedStudentId.value = null
}
async function renameChart(chartId: string): Promise<void> {
  const chart = seatingStore.charts.find((item) => item.id === chartId)
  if (!chart) return
  const { value } = await ElMessageBox.prompt('请输入座位表名称', '重命名', {
    inputValue: chart.name,
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空'
  })
  seatingStore.renameChart(chartId, value)
}
async function deleteChart(chartId: string): Promise<void> {
  await ElMessageBox.confirm('删除后无法恢复该座位表，是否继续？', '删除座位表', {
    type: 'warning'
  })
  seatingStore.deleteChart(chartId)
}
function openLayout(): void {
  if (!editingChart.value) return
  layout.value = { rows: editingChart.value.rows, columns: editingChart.value.columns }
  layoutVisible.value = true
}
async function confirmLayout(): Promise<void> {
  if (!editingChart.value) return
  const affected = getResizeAffectedCount(
    editingChart.value,
    layout.value.rows,
    layout.value.columns
  )
  if (affected)
    await ElMessageBox.confirm(`缩减后将有 ${affected} 名学生变为未安排，是否继续？`, '确认调整', {
      type: 'warning'
    })
  seatingStore.resizeChart(layout.value.rows, layout.value.columns)
  layoutVisible.value = false
}
function openAisles(): void {
  aisles.value = [...(editingChart.value?.aisleAfterColumns || [])]
  aisleVisible.value = true
}
function saveAisles(): void {
  seatingStore.setAisles(aisles.value)
  aisleVisible.value = false
}
function dropOnSeat(seat: SeatPositionType): void {
  const studentId = draggedStudentId.value || selectedStudentId.value
  if (!studentId) return
  seatingStore.assignStudent(studentId, seat.row, seat.column)
  selectedStudentId.value = null
  draggedStudentId.value = null
}
function selectSeat(seat: SeatPositionType): void {
  if (selectedStudentId.value) {
    dropOnSeat(seat)
    return
  }
  if (seat.studentId) selectedStudentId.value = seat.studentId
}
function dropToUnassigned(): void {
  if (draggedStudentId.value) seatingStore.unassignStudent(draggedStudentId.value)
  draggedStudentId.value = null
}
function randomize(): void {
  if (!editingChart.value) return
  if (seatingStore.isEmptyChart) {
    const count = seatingStore.randomizeAll()
    if (count) ElMessage.warning(`座位不足，还有 ${count} 名学生未安排`)
    return
  }
  randomModeVisible.value = true
}
function randomizeAll(): void {
  randomModeVisible.value = false
  const count = seatingStore.randomizeAll()
  if (count) ElMessage.warning(`座位不足，还有 ${count} 名学生未安排`)
}
function generatePreview(): void {
  if (!editingChart.value) return
  preview.value = createRandomSeats(
    editingChart.value,
    activeStudents.value.map((student) => student.id),
    true
  )
}
function openSupplement(): void {
  randomModeVisible.value = false
  generatePreview()
  previewVisible.value = true
}
function applyPreview(): void {
  if (!preview.value) return
  seatingStore.applySupplementPreview(preview.value.seats)
  previewVisible.value = false
  if (preview.value.unassignedCount)
    ElMessage.warning(`还有 ${preview.value.unassignedCount} 名学生未安排`)
}
async function toggleSpecialSeat(
  position: SeatingSpecialSeatPositionEnum,
  enabled: boolean
): Promise<void> {
  const seat = editingChart.value?.specialSeats.find((item) => item.position === position)
  if (!seat) return
  if (!enabled && seat.studentId) {
    try {
      await ElMessageBox.confirm(
        `${studentNames.value.get(seat.studentId)} 将回到未安排学生，是否关闭该雅座？`,
        '关闭雅座',
        { type: 'warning' }
      )
    } catch {
      return
    }
  }
  seatingStore.setSpecialSeatEnabled(position, enabled)
}
function dropOnSpecialSeat(position: SeatingSpecialSeatPositionEnum): void {
  const studentId = draggedStudentId.value || selectedStudentId.value
  if (!studentId) return
  seatingStore.assignStudentToSpecial(studentId, position)
  selectedStudentId.value = null
  draggedStudentId.value = null
}
function selectSpecialSeat(seat: SeatingSpecialSeatType): void {
  if (selectedStudentId.value) {
    dropOnSpecialSeat(seat.position)
    return
  }
  if (seat.studentId) selectedStudentId.value = seat.studentId
}
function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
}
function toggleViewDirection(): void {
  if (!editingChart.value) return
  seatingStore.setViewDirection(
    editingChart.value.viewDirection === SeatingViewDirectionEnum.FacingPlatform
      ? SeatingViewDirectionEnum.FacingStudents
      : SeatingViewDirectionEnum.FacingPlatform
  )
}
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && fullscreen.value) {
    fullscreen.value = false
  }
}
</script>

<template>
  <div class="seating-chart-page app-page-shell" :class="{ fullscreen }">
    <page-header
      v-if="!fullscreen"
      :icon="['solid', 'chair']"
      title="座位表"
      subtitle="安排座位、管理方案并快速随机排座"
    >
      <template #left
        ><el-button size="small" circle aria-label="返回工具" @click="backToTools"
          ><font-awesome-icon :icon="['solid', 'arrow-left']" /></el-button
      ></template>
    </page-header>
    <div class="seating-workspace" :class="{ collapsed: seatingStore.isSidebarCollapsed }">
      <aside class="chart-sidebar">
        <div class="sidebar-heading">
          <strong v-show="!seatingStore.isSidebarCollapsed">座位方案</strong
          ><el-button
            text
            circle
            @click="seatingStore.setSidebarCollapsed(!seatingStore.isSidebarCollapsed)"
            ><font-awesome-icon
              :icon="['solid', seatingStore.isSidebarCollapsed ? 'angles-right' : 'angles-left']"
          /></el-button>
        </div>
        <div class="chart-list">
          <el-tooltip
            v-for="chart in seatingStore.charts"
            :key="chart.id"
            :content="chart.name"
            placement="right"
            :disabled="!seatingStore.isSidebarCollapsed"
            ><button
              class="chart-item"
              :class="{ active: chart.id === editingChart?.id }"
              @click="selectChart(chart.id)"
            >
              <span class="chart-item__dot"></span
              ><span v-show="!seatingStore.isSidebarCollapsed" class="chart-item__name">{{
                chart.name
              }}</span
              ><el-dropdown
                v-if="!seatingStore.isSidebarCollapsed"
                trigger="click"
                @command="
                  (command: string) => {
                    if (command === 'copy') seatingStore.copyChart(chart.id)
                    if (command === 'rename') renameChart(chart.id)
                    if (command === 'delete') deleteChart(chart.id)
                  }
                "
                ><span class="chart-item__more" @click.stop
                  ><font-awesome-icon :icon="['solid', 'ellipsis']" /></span
                ><template #dropdown
                  ><el-dropdown-menu
                    ><el-dropdown-item command="copy">复制</el-dropdown-item
                    ><el-dropdown-item command="rename">重命名</el-dropdown-item
                    ><el-dropdown-item command="delete" divided
                      >删除</el-dropdown-item
                    ></el-dropdown-menu
                  ></template
                ></el-dropdown
              >
            </button></el-tooltip
          >
        </div>
        <el-button
          class="create-chart"
          :circle="seatingStore.isSidebarCollapsed"
          type="primary"
          plain
          @click="createChart"
          ><font-awesome-icon :icon="['solid', 'plus']" /><span
            v-show="!seatingStore.isSidebarCollapsed"
            >新建座位表</span
          ></el-button
        >
      </aside>
      <main v-if="editingChart" class="chart-editor">
        <seating-chart-toolbar
          :chart-name="editingChart.name"
          :assigned-count="assignedCount"
          :seat-capacity="seatCapacity"
          :view-direction="editingChart.viewDirection"
          :fullscreen="fullscreen"
          @open-layout="openLayout"
          @open-aisles="openAisles"
          @open-special-seats="specialSeatVisible = true"
          @toggle-direction="toggleViewDirection"
          @randomize="randomize"
          @export="exportVisible = true"
          @toggle-fullscreen="toggleFullscreen"
        />
        <div class="student-source-bar">
          <student-source-selector
            :source="editingChart.studentSource"
            :system-student-count="dataSourceStore.enabledData.length"
            :excel-file-name="editingChart.excelSource?.fileName"
            :excel-student-count="editingChart.excelSource?.students.length"
            @change="handleStudentSourceChange"
            @upload="openStudentImport"
          />
        </div>
        <seating-chart-canvas
          :chart="editingChart"
          :visible-seat-rows="visibleSeatRows"
          :student-names="studentNames"
          :selected-student-id="selectedStudentId"
          @drag-start="draggedStudentId = $event"
          @drag-end="draggedStudentId = null"
          @drop-seat="dropOnSeat"
          @select-seat="selectSeat"
          @drop-special-seat="dropOnSpecialSeat"
          @select-special-seat="selectSpecialSeat"
        />
      </main>
      <main v-else class="chart-editor empty-chart">
        <div class="editor-toolbar">
          <div>
            <strong>座位表</strong><span class="toolbar-status">设置行列后开始安排学生</span>
          </div>
          <div class="toolbar-actions initial-layout">
            <label
              >行
              <el-input-number
                v-model="initialLayout.rows"
                size="small"
                :min="SEATING_CHART_MIN_SIZE"
                :max="SEATING_CHART_MAX_SIZE"
                controls-position="right" /></label
            ><label
              >列
              <el-input-number
                v-model="initialLayout.columns"
                size="small"
                :min="SEATING_CHART_MIN_SIZE"
                :max="SEATING_CHART_MAX_SIZE"
                controls-position="right" /></label
            ><el-button size="small" type="primary" @click="createInitialChart">应用布局</el-button
            ><el-button size="small" @click="toggleFullscreen"
              ><font-awesome-icon :icon="['solid', fullscreen ? 'compress' : 'expand']" />{{
                fullscreen ? '退出全屏' : '全屏'
              }}</el-button
            >
          </div>
        </div>
        <div class="empty-chart__content">
          <font-awesome-icon :icon="['solid', 'chair']" />
          <h3>
            {{
              dataSourceStore.enabledData.length
                ? '请在上方工具栏设置行列'
                : '上传 Excel 名单开始排座'
            }}
          </h3>
          <p>
            {{
              dataSourceStore.enabledData.length
                ? '应用布局后即可安排学生、设置过道和随机排座。'
                : '当前没有系统学生，应用布局后将进入 Excel 名单导入。'
            }}
          </p>
          <el-button
            v-if="!dataSourceStore.enabledData.length"
            type="primary"
            @click="openStudentImport"
          >
            <font-awesome-icon :icon="['solid', 'file-arrow-up']" />上传 Excel 名单
          </el-button>
        </div>
      </main>
      <unassigned-student-panel
        :students="unassignedStudents"
        :total-student-count="activeStudents.length"
        :selected-student-id="selectedStudentId"
        @drag-start="draggedStudentId = $event"
        @drag-end="draggedStudentId = null"
        @select-student="selectedStudentId = $event"
        @drop-to-unassigned="dropToUnassigned"
      />
    </div>
    <el-dialog v-model="layoutVisible" width="460px"
      ><template #header
        ><seating-dialog-header
          icon="table-cells"
          title="设置座位行列"
          description="调整规则座位网格，原有安排会尽量保留"
      /></template>
      <div class="compact-layout-form">
        <label
          ><span>行数<small>纵向座位排数</small></span
          ><el-input-number
            v-model="layout.rows"
            :min="SEATING_CHART_MIN_SIZE"
            :max="SEATING_CHART_MAX_SIZE" /></label
        ><label
          ><span>列数<small>横向座位列数</small></span
          ><el-input-number
            v-model="layout.columns"
            :min="SEATING_CHART_MIN_SIZE"
            :max="SEATING_CHART_MAX_SIZE"
        /></label>
      </div>
      <template #footer
        ><el-button @click="layoutVisible = false">取消</el-button
        ><el-button type="primary" @click="confirmLayout">确认</el-button></template
      ></el-dialog
    >
    <el-dialog v-model="aisleVisible" width="500px"
      ><template #header
        ><seating-dialog-header
          icon="road"
          title="设置列间过道"
          description="勾选需要留出过道的列，过道不占座位容量" /></template
      ><el-checkbox-group v-model="aisles" class="aisle-options"
        ><el-checkbox
          v-for="column in Math.max(0, (editingChart?.columns || 1) - 1)"
          :key="column"
          :value="column - 1"
          >第 {{ column }} 列后</el-checkbox
        ></el-checkbox-group
      ><template #footer
        ><el-button @click="aisleVisible = false">取消</el-button
        ><el-button type="primary" @click="saveAisles">保存</el-button></template
      ></el-dialog
    >
    <special-seat-settings-dialog
      v-if="editingChart"
      v-model="specialSeatVisible"
      :seats="editingChart.specialSeats"
      :student-names="studentNameRecord"
      @toggle="toggleSpecialSeat"
    />
    <SeatingChartExportDialog
      v-if="editingChart"
      v-model="exportVisible"
      :chart="editingChart"
      :student-names="studentNameRecord"
    />
    <random-mode-dialog
      v-model="randomModeVisible"
      :assigned-count="assignedCount"
      :unassigned-count="unassignedStudents.length"
      @randomize-all="randomizeAll"
      @supplement="openSupplement"
    />
    <random-supplement-preview-dialog
      v-if="preview && editingChart"
      v-model="previewVisible"
      :chart="editingChart"
      :preview="preview"
      :student-names="studentNameRecord"
      @regenerate="generatePreview"
      @confirm="applyPreview"
    />
    <seating-student-import-dialog
      v-model="studentImportVisible"
      @confirm="handleExcelStudentImport"
    />
  </div>
</template>

<style scoped lang="scss">
.seating-chart-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.seating-workspace {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr) 276px;
  min-height: 620px;
  overflow: hidden;
  border: 1px solid #e6e0ef;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 38px rgba(50, 35, 81, 0.07);
}
.seating-workspace.collapsed {
  grid-template-columns: 64px minmax(0, 1fr) 276px;
}
.chart-sidebar {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #fbfaff;
  border-right: 1px solid #eeeaf3;
}
.sidebar-heading,
.editor-toolbar,
.toolbar-actions {
  display: flex;
  align-items: center;
}
.student-source-bar {
  padding: 9px 18px;
  background: #fbfdff;
  border-bottom: 1px solid #eeeaf3;
}
.sidebar-heading {
  justify-content: space-between;
  margin-bottom: 10px;
}
.chart-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
}
.chart-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 8px;
  border: 0;
  border-radius: 9px;
  color: #625b70;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.chart-item:hover,
.chart-item.active {
  color: #6232b8;
  background: #f0e8ff;
}
.chart-item__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b7a9cf;
}
.active .chart-item__dot {
  background: #7c3aed;
}
.chart-item__name {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chart-item__more {
  padding: 2px 5px;
  color: #81768f;
}
.create-chart {
  justify-content: center;
  margin-top: 12px;
}
.chart-editor {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.editor-toolbar {
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  height: 48px;
  padding: 0 14px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid #eeeaf3;
  scrollbar-width: none;
}
.editor-toolbar::-webkit-scrollbar {
  display: none;
}
.editor-toolbar > div:first-child {
  flex: 0 0 auto;
  white-space: nowrap;
}
.editor-toolbar strong {
  font-size: 17px;
  color: #2d233d;
}
.toolbar-status {
  margin-left: 10px;
  color: #8a8295;
  font-size: 12px;
}
.toolbar-actions {
  flex: 0 0 auto;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 7px;
  white-space: nowrap;
}
.toolbar-actions :deep(.el-button) {
  flex-shrink: 0;
  margin-left: 0;
}
.dialog-tip {
  color: #938a9d;
  font-size: 12px;
}
.empty-chart {
  display: grid;
  place-content: center;
  gap: 12px;
  color: #81768f;
  text-align: center;
}
.empty-chart svg {
  margin: auto;
  color: #9d76df;
  font-size: 34px;
}
.empty-chart h3,
.empty-chart p {
  margin: 0;
}
.random-options {
  display: grid;
  gap: 10px;
}
.random-options button {
  display: grid;
  gap: 5px;
  padding: 15px;
  border: 1px solid #e3dbea;
  border-radius: 10px;
  background: #fcfbfe;
  text-align: left;
  cursor: pointer;
}
.random-options button:hover {
  border-color: #9d76df;
  background: #f7f3ff;
}
.random-options span {
  color: #8d8497;
  font-size: 12px;
}
.preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 210px;
  gap: 18px;
}
.preview-grid {
  display: grid;
  gap: 8px;
}
.preview-seat {
  position: relative;
  min-height: 58px;
  padding: 8px;
  border: 1px solid #e3ddea;
  border-radius: 9px;
  background: #fff;
}
.preview-seat.random {
  border-color: #fb923c;
  background: #fff7ed;
}
.preview-seat .el-tag {
  position: absolute;
  top: 4px;
  right: 4px;
}
.preview-seat strong {
  display: block;
  padding-right: 27px;
  font-size: 13px;
}
.preview-side {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.preview-side .el-button {
  margin-top: auto;
}
.empty-chart {
  display: flex;
  flex-direction: column;
}
.empty-chart__content {
  display: grid;
  place-content: center;
  flex: 1;
  gap: 12px;
  color: #81768f;
  text-align: center;
}
.empty-chart__content > svg {
  margin: auto;
  color: #9d76df;
  font-size: 34px;
}
.empty-chart h3,
.empty-chart p {
  margin: 0;
}
.initial-layout label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #5f566b;
  font-size: 13px;
}
.initial-layout :deep(.el-input-number) {
  width: 76px;
}
.seating-chart-page.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2000;
  width: 100vw;
  height: 100vh;
  padding: 8px;
}
.seating-workspace {
  flex: 1;
  min-height: 0;
}
.chart-sidebar,
.chart-editor,
.unassigned-panel {
  min-height: 0;
}
.chart-item__name {
  font-size: 13px;
}
.preview-classroom {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  overflow: auto;
}
.preview-classroom.facing-students {
  flex-direction: column-reverse;
}
.preview-platform {
  width: 55%;
  margin: 0 auto;
  padding: 8px;
  border-radius: 8px;
  color: #fff;
  background: #3d286d;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.25em;
}
.preview-grid {
  min-width: max-content;
}
.compact-layout-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.compact-layout-form label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  background: #fcfbfd;
  border: 1px solid #ebe5ef;
  border-radius: 11px;
}
.compact-layout-form label > span {
  display: grid;
  gap: 3px;
  color: #403648;
  font-size: 13px;
  font-weight: 600;
}
.compact-layout-form small {
  color: #9a909f;
  font-size: 10px;
  font-weight: 400;
}
.compact-layout-form :deep(.el-input-number) {
  width: 102px;
}
.aisle-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
}
.aisle-options :deep(.el-checkbox) {
  width: 100%;
  height: auto;
  margin: 0;
  padding: 9px 10px;
  background: #fcfbfd;
  border: 1px solid #ebe5ef;
  border-radius: 9px;
}
.aisle-options :deep(.el-checkbox.is-checked) {
  background: #f5efff;
  border-color: #bca2df;
}
@media (max-width: 1100px) {
  .seating-workspace,
  .seating-workspace.collapsed {
    grid-template-columns: 58px minmax(0, 1fr) 240px;
  }
  .chart-item__name,
  .chart-item .el-tag,
  .chart-item__more,
  .sidebar-heading strong,
  .create-chart span {
    display: none;
  }
  .chart-item {
    justify-content: center;
  }
  .preview-layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 820px) {
  .seating-workspace,
  .seating-workspace.collapsed {
    grid-template-columns: 1fr;
  }
  .chart-sidebar {
    display: none;
  }
  .toolbar-actions {
    justify-content: flex-start;
  }
}
</style>
