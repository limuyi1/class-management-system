<script setup lang="ts">
/** 座位表页面 — 教室布局设计、随机排座、学生拖拽分配和导出 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import ExcelStudentRosterDialog from '@/components/student-source/ExcelStudentRosterDialog.vue'
import StudentSourceSelector from '@/components/student-source/StudentSourceSelector.vue'
import { useDataSourceStore } from '@/stores/data-source'
import { useSeatingChartStore } from '@/stores/seating-chart'
import RandomModeDialog from '@/views/seating-chart/components/RandomModeDialog.vue'
import RandomSupplementPreviewDialog from '@/views/seating-chart/components/RandomSupplementPreviewDialog.vue'
import SeatingChartCanvas from '@/views/seating-chart/components/SeatingChartCanvas.vue'
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'
import SeatingChartExportDialog from '@/views/seating-chart/components/SeatingChartExportDialog.vue'
import SeatingChartToolbar from '@/views/seating-chart/components/SeatingChartToolbar.vue'
import SeatingNotesPanel from '@/views/seating-chart/components/SeatingNotesPanel.vue'
import SeatingRoleManagementDialog from '@/views/seating-chart/components/SeatingRoleManagementDialog.vue'
import SeatingStudentImportDialog from '@/views/seating-chart/components/SeatingStudentImportDialog.vue'
import SeatingStudentContextMenu from '@/views/seating-chart/components/SeatingStudentContextMenu.vue'
import SpecialSeatSettingsDialog from '@/views/seating-chart/components/SpecialSeatSettingsDialog.vue'
import UnassignedStudentPanel from '@/views/seating-chart/components/UnassignedStudentPanel.vue'
import {
  SeatingFirstColumnSideEnum,
  SeatingSpecialSeatPositionEnum,
  type SeatingChartPreviewType,
  type SeatingRoleAssignmentType,
  type SeatingRoleDefinitionType,
  type SeatingSpecialSeatType,
  type SeatPositionType
} from '@/types/SeatingChart'
import {
  createRandomSeats,
  getResizeAffectedCount,
  getVisibleSeats,
  SEATING_CHART_MAX_SIZE,
  SEATING_CHART_MIN_SIZE
} from '@/utils/seating-chart/seatingChartUtil'

import type {
  ExcelStudentSourceType,
  StudentSourceStudentType,
  StudentSourceType
} from '@/types/StudentSource'

const router = useRouter()
const seatingStore = useSeatingChartStore()
const dataSourceStore = useDataSourceStore()
// 座位表 store 的响应式数据；editingChart 为当前编辑中的座位表
const { activeStudents, editingChart, unassignedStudents, assignedCount, seatCapacity } =
  storeToRefs(seatingStore)
// 页面是否全屏显示
const fullscreen = shallowRef(false)
// 正在拖拽的学生 ID，跨组件传递拖拽目标
const draggedStudentId = ref<string | null>(null)
// 点击选中的学生 ID，用于拖拽或点击落座
const selectedStudentId = ref<string | null>(null)
// 各类弹窗的显隐状态
const layoutVisible = ref(false)
const aisleVisible = ref(false)
const randomModeVisible = ref(false)
const previewVisible = ref(false)
const specialSeatVisible = ref(false)
const exportVisible = shallowRef(false)
const studentImportVisible = shallowRef(false)
const studentRosterVisible = shallowRef(false)
const roleManagementVisible = shallowRef(false)
const notesVisible = shallowRef(false)
const notesDraft = ref('')
const studentMenu = shallowRef<{ studentId: string; x: number; y: number } | null>(null)
// Excel 导入的目标：创建新座位表或替换当前名单
const studentImportTarget = shallowRef<'create' | 'replace'>('create')
// 新建流程中暂存的学生来源与 Excel 名单，创建时写入 store
const initialStudentSource = ref<StudentSourceType>(
  dataSourceStore.enabledData.length ? 'system' : 'excel'
)
const initialExcelSource = shallowRef<ExcelStudentSourceType | null>(null)
// 布局弹窗中的临时行列与第一列方向设置
const layout = ref({
  rows: 6,
  columns: 6,
  firstColumnSide: SeatingFirstColumnSideEnum.Left
})
// 新建座位表时的初始布局设置
const initialLayout = ref({
  rows: 6,
  columns: 6,
  firstColumnSide: SeatingFirstColumnSideEnum.Left
})
// 过道弹窗中的临时过道列设置
const aisles = ref<number[]>([])
// 补充空座位的随机方案预览数据
const preview = ref<SeatingChartPreviewType | null>(null)

/** 学生 ID 到姓名的映射，供画布与提示文案使用 */
const studentNames = computed(
  () => new Map(activeStudents.value.map((student) => [student.id, student.name]))
)
/** 学生姓名字典，供需要普通对象格式的子组件使用 */
const studentNameRecord = computed<Record<string, string>>(() =>
  Object.fromEntries(studentNames.value)
)
/** 右键菜单当前学生的姓名 */
const menuStudentName = computed(() =>
  studentMenu.value ? studentNames.value.get(studentMenu.value.studentId) || '未命名学生' : ''
)
/** 右键菜单当前学生已有的职务 */
const menuAssignedRoleIds = computed(
  () =>
    editingChart.value?.roleAssignments.find(
      (assignment) => assignment.studentId === studentMenu.value?.studentId
    )?.roleIds || []
)
/** 当前名单中已有座位或职务的学生 ID，供删除影响提示使用 */
const managedAssignedStudentIds = computed(() => {
  const studentIds = new Set(seatingStore.assignedStudentIds)
  editingChart.value?.roleAssignments.forEach((assignment) => studentIds.add(assignment.studentId))
  return [...studentIds]
})
/** 当前座位表的可见座位（过滤过道占位列） */
const visibleSeats = computed(() => (editingChart.value ? getVisibleSeats(editingChart.value) : []))
/** 将可见座位按行分组，供画布逐行渲染 */
const visibleSeatRows = computed(() => {
  const rows: SeatPositionType[][] = []
  visibleSeats.value.forEach((seat) => {
    const currentRow = rows[rows.length - 1]
    if (!currentRow || currentRow[0].row !== seat.row) rows.push([seat])
    else currentRow.push(seat)
  })
  return rows
})

// 系统学生名单变化时重新校对座位表数据，并同步新建流程的默认来源
watch(
  () => dataSourceStore.enabledData.map((student) => student.studentId).join(','),
  () => {
    seatingStore.reconcileStudents()
    if (editingChart.value || initialExcelSource.value) return
    initialStudentSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
  }
)

// 挂载时校对名单数据，并注册键盘快捷键监听
onMounted(() => {
  seatingStore.reconcileStudents()
  document.addEventListener('click', closeStudentMenu)
  window.addEventListener('keydown', handleKeydown)
})

// 卸载时移除键盘监听
onBeforeUnmount(() => {
  document.removeEventListener('click', closeStudentMenu)
  window.removeEventListener('keydown', handleKeydown)
})

/** 关闭学生职务右键菜单 */
function closeStudentMenu(): void {
  studentMenu.value = null
}

/** 返回工具页面 */
function backToTools(): void {
  router.push('/tools')
}
/** 进入新建座位表流程，重置默认布局与名单来源 */
function createChart(): void {
  initialLayout.value = {
    rows: 6,
    columns: 6,
    firstColumnSide: SeatingFirstColumnSideEnum.Left
  }
  initialExcelSource.value = null
  initialStudentSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
  seatingStore.startCreatingChart()
}
/** 依据新建流程中暂存的来源与布局创建座位表；Excel 名单缺失时先打开导入弹窗 */
function createInitialChart(): void {
  if (initialStudentSource.value === 'system' && dataSourceStore.enabledData.length) {
    seatingStore.createChart({
      studentSource: 'system',
      rows: initialLayout.value.rows,
      columns: initialLayout.value.columns,
      firstColumnSide: initialLayout.value.firstColumnSide
    })
    return
  }
  if (!initialExcelSource.value) {
    openInitialStudentImport()
    return
  }
  seatingStore.createChart({
    studentSource: 'excel',
    excelSource: initialExcelSource.value,
    rows: initialLayout.value.rows,
    columns: initialLayout.value.columns,
    firstColumnSide: initialLayout.value.firstColumnSide
  })
}

/** 更换学生来源前确认清空已有安排，返回是否继续 */
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

/** 处理学生来源切换；Excel 来源缺失名单时先打开导入弹窗 */
async function handleStudentSourceChange(source: StudentSourceType): Promise<void> {
  if (!editingChart.value || source === editingChart.value.studentSource) return
  if (!(await confirmClearAssignments())) return

  if (source === 'excel') {
    if (!editingChart.value.excelSource) {
      studentImportTarget.value = 'replace'
      studentImportVisible.value = true
      return
    }
    seatingStore.setStudentSource('excel', editingChart.value.excelSource)
    return
  }
  seatingStore.setStudentSource('system')
}

/** 打开 Excel 名单导入弹窗；已有座位表时先确认清空安排 */
async function openStudentImport(): Promise<void> {
  if (editingChart.value && !(await confirmClearAssignments())) return
  studentImportTarget.value = editingChart.value ? 'replace' : 'create'
  studentImportVisible.value = true
}

/** 新建流程中打开 Excel 名单导入弹窗 */
function openInitialStudentImport(): void {
  studentImportTarget.value = 'create'
  studentImportVisible.value = true
}

/** 记录新建流程中选择的学生来源 */
function handleInitialStudentSourceChange(source: StudentSourceType): void {
  initialStudentSource.value = source
}

/** 处理 Excel 导入结果：替换当前来源或暂存到新建流程，并提示导入人数 */
function handleExcelStudentImport(source: ExcelStudentSourceType): void {
  if (studentImportTarget.value === 'replace' && editingChart.value) {
    seatingStore.setStudentSource('excel', source)
  } else {
    initialExcelSource.value = source
    initialStudentSource.value = 'excel'
  }
  ElMessage.success(`已导入 ${source.students.length} 名学生`)
}
/** 向当前座位表的外部名单追加学生 */
function addExcelStudent(name: string): void {
  if (!seatingStore.addExcelStudent(name)) return
  ElMessage.success(`已将“${name}”添加到当前座位表`)
}

/** 确认后从当前座位表外部名单删除学生及其关联安排 */
async function removeExcelStudent(student: StudentSourceStudentType): Promise<void> {
  const hasAssignment = managedAssignedStudentIds.value.includes(student.id)
  const message = hasAssignment
    ? `“${student.name}”已有座位或职务安排，删除后相关安排也会一并移除。是否继续？`
    : `确定从当前座位表名单中删除“${student.name}”吗？`
  try {
    await ElMessageBox.confirm(message, '删除名单学生', { type: 'warning' })
  } catch {
    return
  }
  if (!seatingStore.removeExcelStudent(student.id)) return
  if (selectedStudentId.value === student.id) selectedStudentId.value = null
  if (studentMenu.value?.studentId === student.id) closeStudentMenu()
  ElMessage.success(`已从当前座位表删除“${student.name}”`)
}
/** 切换当前编辑的座位表，并清除选中学生 */
function selectChart(chartId: string): void {
  seatingStore.setEditingChart(chartId)
  selectedStudentId.value = null
  closeStudentMenu()
}
/** 弹出输入框重命名座位表 */
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
/**
 * 二次确认后删除指定座位表。
 * @param chartId - 座位表 ID
 */
async function deleteChart(chartId: string): Promise<void> {
  await ElMessageBox.confirm('删除后无法恢复该座位表，是否继续？', '删除座位表', {
    type: 'warning'
  })
  seatingStore.deleteChart(chartId)
}
/** 打开布局弹窗，用当前座位表设置初始化临时布局 */
function openLayout(): void {
  if (!editingChart.value) return
  layout.value = {
    rows: editingChart.value.rows,
    columns: editingChart.value.columns,
    firstColumnSide: editingChart.value.firstColumnSide
  }
  layoutVisible.value = true
}
/** 应用行列调整；缩减座位时先确认受影响学生数量 */
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
  seatingStore.setFirstColumnSide(layout.value.firstColumnSide)
  layoutVisible.value = false
}
/** 打开过道弹窗，用当前过道设置初始化 */
function openAisles(): void {
  aisles.value = [...(editingChart.value?.aisleAfterColumns || [])]
  aisleVisible.value = true
}
/** 保存过道设置 */
function saveAisles(): void {
  seatingStore.setAisles(aisles.value)
  aisleVisible.value = false
}
/** 将拖拽或选中的学生放入指定座位 */
function dropOnSeat(seat: SeatPositionType): void {
  const studentId = draggedStudentId.value || selectedStudentId.value
  if (!studentId) return
  seatingStore.assignStudent(studentId, seat.row, seat.column)
  selectedStudentId.value = null
  draggedStudentId.value = null
}
/**
 * 点击座位：已有选中学生时执行落座，否则选中该座位上的学生。
 * @param seat - 被点击的座位
 */
function selectSeat(seat: SeatPositionType): void {
  if (selectedStudentId.value) {
    dropOnSeat(seat)
    return
  }
  if (seat.studentId) selectedStudentId.value = seat.studentId
}
/** 将拖拽中的学生移回未安排列表 */
function dropToUnassigned(): void {
  if (draggedStudentId.value) seatingStore.unassignStudent(draggedStudentId.value)
  draggedStudentId.value = null
}
/** 随机排座入口：空座位表直接全部随机，否则弹出模式选择 */
function randomize(): void {
  if (!editingChart.value) return
  if (seatingStore.isEmptyChart) {
    const count = seatingStore.randomizeAll()
    if (count) ElMessage.warning(`座位不足，还有 ${count} 名学生未安排`)
    return
  }
  randomModeVisible.value = true
}
/** 清空并重新随机安排全部学生，座位不足时提示未安排数量 */
function randomizeAll(): void {
  randomModeVisible.value = false
  const count = seatingStore.randomizeAll()
  if (count) ElMessage.warning(`座位不足，还有 ${count} 名学生未安排`)
}
/** 生成“补充空座位”的随机方案预览 */
function generatePreview(): void {
  if (!editingChart.value) return
  preview.value = createRandomSeats(
    editingChart.value,
    activeStudents.value.map((student) => student.id),
    true
  )
}
/** 关闭模式弹窗并打开补充方案预览 */
function openSupplement(): void {
  randomModeVisible.value = false
  generatePreview()
  previewVisible.value = true
}
/** 应用补充方案预览，仍有未安排学生时给出提示 */
function applyPreview(): void {
  if (!preview.value) return
  seatingStore.applySupplementPreview(preview.value.seats)
  previewVisible.value = false
  if (preview.value.unassignedCount)
    ElMessage.warning(`还有 ${preview.value.unassignedCount} 名学生未安排`)
}
/**
 * 开关雅座；关闭已占用雅座前需二次确认，避免学生意外回到未安排。
 * @param position - 雅座位置
 * @param enabled - 是否启用
 */
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
/**
 * 将拖拽或选中的学生放入指定雅座。
 * @param position - 雅座位置
 */
function dropOnSpecialSeat(position: SeatingSpecialSeatPositionEnum): void {
  // 优先使用拖拽中的学生，其次使用点击选中的学生
  const studentId = draggedStudentId.value || selectedStudentId.value
  if (!studentId) return
  seatingStore.assignStudentToSpecial(studentId, position)
  selectedStudentId.value = null
  draggedStudentId.value = null
}
/**
 * 点击雅座：已有选中学生时执行落座，否则选中该雅座上的学生。
 * @param seat - 被点击的雅座
 */
function selectSpecialSeat(seat: SeatingSpecialSeatType): void {
  if (selectedStudentId.value) {
    dropOnSpecialSeat(seat.position)
    return
  }
  if (seat.studentId) selectedStudentId.value = seat.studentId
}
/** 打开学生职务右键菜单 */
function openStudentMenu(studentId: string, x: number, y: number): void {
  studentMenu.value = { studentId, x, y }
}
/** 从右键菜单切换当前学生的职务 */
function toggleMenuStudentRole(roleId: string): void {
  if (!studentMenu.value) return
  seatingStore.toggleStudentRole(studentMenu.value.studentId, roleId)
}
/** 从右键菜单进入完整职务管理 */
function manageRolesFromMenu(): void {
  closeStudentMenu()
  roleManagementVisible.value = true
}
/** 保存职务定义和学生分配 */
function saveRoleSettings(
  definitions: SeatingRoleDefinitionType[],
  assignments: SeatingRoleAssignmentType[]
): void {
  seatingStore.setRoleSettings(definitions, assignments)
  ElMessage.success('职务设置已保存')
}
/** 打开备注编辑弹窗 */
function editNotes(): void {
  notesDraft.value = editingChart.value?.notes || ''
  notesVisible.value = true
}
/** 保存备注说明 */
function saveNotes(): void {
  seatingStore.setNotes(notesDraft.value)
  notesVisible.value = false
}
/** 切换页面全屏显示 */
function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
}
/**
 * 处理键盘快捷键，全屏时按 Esc 退出。
 * @param event - 键盘事件
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && fullscreen.value) {
    fullscreen.value = false
  }
  if (event.key === 'Escape') closeStudentMenu()
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
    <div
      class="seating-workspace"
      :class="{
        collapsed: seatingStore.isSidebarCollapsed,
        'has-chart': Boolean(editingChart)
      }"
    >
      <!-- 左侧：座位方案列表 -->
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
          v-if="editingChart"
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
      <!-- 中间：座位表编辑区（工具栏 + 座位画布） -->
      <main v-if="editingChart" class="chart-editor">
        <seating-chart-toolbar
          :chart-name="editingChart.name"
          :assigned-count="assignedCount"
          :seat-capacity="seatCapacity"
          :fullscreen="fullscreen"
          @open-layout="openLayout"
          @open-aisles="openAisles"
          @open-special-seats="specialSeatVisible = true"
          @manage-roles="roleManagementVisible = true"
          @randomize="randomize"
          @export="exportVisible = true"
          @toggle-fullscreen="toggleFullscreen"
        />
        <seating-chart-canvas
          :chart="editingChart"
          :visible-seat-rows="visibleSeatRows"
          :student-names="studentNames"
          :selected-student-id="selectedStudentId"
          :role-definitions="editingChart.roleDefinitions"
          :role-assignments="editingChart.roleAssignments"
          @drag-start="draggedStudentId = $event"
          @drag-end="draggedStudentId = null"
          @drop-seat="dropOnSeat"
          @select-seat="selectSeat"
          @drop-special-seat="dropOnSpecialSeat"
          @select-special-seat="selectSpecialSeat"
          @open-student-menu="openStudentMenu"
        />
        <SeatingNotesPanel :notes="editingChart.notes" @edit="editNotes" />
      </main>
      <!-- 无座位表时显示新建向导 -->
      <main v-else class="chart-editor empty-chart">
        <div class="editor-toolbar">
          <div>
            <strong>新建座位表</strong
            ><span class="toolbar-status">选择学生名单并设置座位布局</span>
          </div>
          <div class="toolbar-actions">
            <el-button size="small" @click="toggleFullscreen"
              ><font-awesome-icon :icon="['solid', fullscreen ? 'compress' : 'expand']" />{{
                fullscreen ? '退出全屏' : '全屏'
              }}</el-button
            >
          </div>
        </div>
        <div class="empty-chart__content">
          <section class="create-chart-card">
            <div class="create-chart-card__heading">
              <span><font-awesome-icon :icon="['solid', 'chair']" /></span>
              <div>
                <h3>创建一张新的座位表</h3>
                <p>完成名单和布局设置后，再进入座位安排。</p>
              </div>
            </div>

            <div class="create-chart-field">
              <div class="create-chart-field__label">
                <strong>学生名单</strong>
                <small>系统学生可用时默认选中，也可以上传临时 Excel 名单</small>
              </div>
              <student-source-selector
                :source="initialStudentSource"
                :system-student-count="dataSourceStore.enabledData.length"
                :excel-file-name="initialExcelSource?.fileName"
                :excel-student-count="initialExcelSource?.students.length"
                @change="handleInitialStudentSourceChange"
                @upload="openInitialStudentImport"
              />
            </div>

            <div class="create-chart-field">
              <div class="create-chart-field__label">
                <strong>座位布局</strong>
                <small>创建后仍可继续调整行列</small>
              </div>
              <div class="create-chart-layout">
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
                    controls-position="right"
                /></label>
              </div>
              <div class="first-column-setting">
                <span>第一列位置</span>
                <el-radio-group v-model="initialLayout.firstColumnSide" size="small">
                  <el-radio-button :value="SeatingFirstColumnSideEnum.Left">
                    第 1 列在左侧
                  </el-radio-button>
                  <el-radio-button :value="SeatingFirstColumnSideEnum.Right">
                    第 1 列在右侧
                  </el-radio-button>
                </el-radio-group>
                <small>以当前座位表视图为准，讲台始终位于上方</small>
              </div>
            </div>

            <div class="create-chart-card__footer">
              <span v-if="initialStudentSource === 'system'">
                将使用 {{ dataSourceStore.enabledData.length }} 名系统学生
              </span>
              <span v-else-if="initialExcelSource">
                将使用 {{ initialExcelSource.students.length }} 名 Excel 学生
              </span>
              <span v-else>请先上传 Excel 学生名单</span>
              <el-button type="primary" @click="createInitialChart">
                <font-awesome-icon
                  :icon="[
                    'solid',
                    initialStudentSource === 'excel' && !initialExcelSource
                      ? 'file-arrow-up'
                      : 'plus'
                  ]"
                />
                {{
                  initialStudentSource === 'excel' && !initialExcelSource
                    ? '上传 Excel 名单'
                    : '创建座位表'
                }}
              </el-button>
            </div>
          </section>
        </div>
      </main>
      <!-- 右侧：未安排学生面板 -->
      <unassigned-student-panel
        v-if="editingChart"
        :students="unassignedStudents"
        :total-student-count="activeStudents.length"
        :selected-student-id="selectedStudentId"
        @drag-start="draggedStudentId = $event"
        @drag-end="draggedStudentId = null"
        @select-student="selectedStudentId = $event"
        @drop-to-unassigned="dropToUnassigned"
      >
        <template v-if="editingChart" #source>
          <student-source-selector
            :source="editingChart.studentSource"
            :system-student-count="dataSourceStore.enabledData.length"
            :excel-file-name="editingChart.excelSource?.fileName"
            :excel-student-count="editingChart.excelSource?.students.length"
            @change="handleStudentSourceChange"
            @upload="openStudentImport"
          >
            <template v-if="editingChart.studentSource === 'excel'" #actions>
              <el-tooltip content="管理当前外部名单" placement="bottom">
                <el-button
                  size="small"
                  circle
                  aria-label="管理当前外部名单"
                  @click="studentRosterVisible = true"
                >
                  <font-awesome-icon :icon="['solid', 'user-pen']" />
                </el-button>
              </el-tooltip>
            </template>
          </student-source-selector>
        </template>
      </unassigned-student-panel>
    </div>
    <SeatingStudentContextMenu
      v-if="studentMenu && editingChart"
      :x="studentMenu.x"
      :y="studentMenu.y"
      :student-name="menuStudentName"
      :roles="editingChart.roleDefinitions"
      :assigned-role-ids="menuAssignedRoleIds"
      @toggle-role="toggleMenuStudentRole"
      @manage="manageRolesFromMenu"
    />
    <SeatingRoleManagementDialog
      v-if="editingChart"
      v-model="roleManagementVisible"
      :definitions="editingChart.roleDefinitions"
      :assignments="editingChart.roleAssignments"
      :students="activeStudents"
      @save="saveRoleSettings"
    />
    <ExcelStudentRosterDialog
      v-if="editingChart?.studentSource === 'excel' && editingChart.excelSource"
      v-model="studentRosterVisible"
      scope-label="当前座位表"
      :students="editingChart.excelSource.students"
      :assigned-student-ids="managedAssignedStudentIds"
      @add="addExcelStudent"
      @remove="removeExcelStudent"
    />
    <!-- 弹窗：设置座位布局 -->
    <el-dialog v-model="layoutVisible" width="460px"
      ><template #header
        ><seating-dialog-header
          icon="table-cells"
          title="设置座位布局"
          description="调整规则座位网格和第一列位置，原有安排会尽量保留"
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
      <div class="first-column-setting first-column-setting--dialog">
        <span>第一列位置</span>
        <el-radio-group v-model="layout.firstColumnSide">
          <el-radio-button :value="SeatingFirstColumnSideEnum.Left">
            第 1 列在左侧
          </el-radio-button>
          <el-radio-button :value="SeatingFirstColumnSideEnum.Right">
            第 1 列在右侧
          </el-radio-button>
        </el-radio-group>
        <small>通常选择靠近教室门或走廊的一侧；讲台始终位于上方</small>
      </div>
      <template #footer
        ><el-button @click="layoutVisible = false">取消</el-button
        ><el-button type="primary" @click="confirmLayout">确认</el-button></template
      ></el-dialog
    >
    <!-- 弹窗：设置列间过道 -->
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
    <!-- 弹窗：雅座设置 -->
    <special-seat-settings-dialog
      v-if="editingChart"
      v-model="specialSeatVisible"
      :seats="editingChart.specialSeats"
      :student-names="studentNameRecord"
      @toggle="toggleSpecialSeat"
    />
    <!-- 弹窗：导出座位表 -->
    <SeatingChartExportDialog
      v-if="editingChart"
      v-model="exportVisible"
      :chart="editingChart"
      :student-names="studentNameRecord"
    />
    <!-- 弹窗：选择随机排座模式 -->
    <random-mode-dialog
      v-model="randomModeVisible"
      :assigned-count="assignedCount"
      :unassigned-count="unassignedStudents.length"
      @randomize-all="randomizeAll"
      @supplement="openSupplement"
    />
    <!-- 弹窗：补充空座位方案预览 -->
    <random-supplement-preview-dialog
      v-if="preview && editingChart"
      v-model="previewVisible"
      :chart="editingChart"
      :preview="preview"
      :student-names="studentNameRecord"
      @regenerate="generatePreview"
      @confirm="applyPreview"
    />
    <!-- 弹窗：导入 Excel 名单 -->
    <seating-student-import-dialog
      v-model="studentImportVisible"
      @confirm="handleExcelStudentImport"
    />
    <el-dialog v-model="notesVisible" title="编辑备注说明" width="620px">
      <el-input
        v-model="notesDraft"
        type="textarea"
        :rows="8"
        maxlength="500"
        show-word-limit
        resize="none"
        placeholder="每行填写一条说明，可用于座位调整、特殊安排或打印提示"
      />
      <template #footer>
        <el-button @click="notesVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNotes">保存说明</el-button>
      </template>
    </el-dialog>
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
  grid-template-columns: 210px minmax(0, 1fr);
  min-height: 620px;
  overflow: hidden;
  border: 1px solid #e6e0ef;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 38px rgba(50, 35, 81, 0.07);
}
.seating-workspace.has-chart {
  grid-template-columns: 210px minmax(0, 1fr) 276px;
}
.seating-workspace.collapsed {
  grid-template-columns: 64px minmax(0, 1fr);
}
.seating-workspace.collapsed.has-chart {
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 32px;
  color: #81768f;
}
.create-chart-card {
  width: min(680px, 100%);
  padding: 26px;
  background: #fff;
  border: 1px solid #e8e1ee;
  border-radius: 16px;
  box-shadow: 0 16px 38px rgba(57, 39, 76, 0.08);
}
.create-chart-card__heading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eeeaf3;
}
.create-chart-card__heading > span {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  color: #7445bd;
  background: #f0e9fb;
  border-radius: 13px;
  font-size: 19px;
}
.create-chart-card h3,
.create-chart-card p {
  margin: 0;
}
.create-chart-card h3 {
  color: #33283f;
  font-size: 17px;
}
.create-chart-card p {
  margin-top: 5px;
  color: #8d8497;
  font-size: 12px;
}
.create-chart-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 20px 2px;
  border-bottom: 1px solid #f0edf3;
}
.create-chart-field__label {
  display: grid;
  gap: 4px;
}
.create-chart-field__label strong {
  color: #403648;
  font-size: 14px;
}
.create-chart-field__label small {
  color: #948b9d;
  font-size: 11px;
}
.create-chart-field :deep(.student-source-selector__caption) {
  display: none;
}
.create-chart-layout {
  display: flex;
  gap: 10px;
}
.create-chart-layout label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #5f566b;
  font-size: 13px;
}
.create-chart-layout :deep(.el-input-number) {
  width: 82px;
}
.first-column-setting {
  display: grid;
  grid-column: 2;
  gap: 8px;
  justify-items: start;
}
.first-column-setting > span {
  color: #5f566b;
  font-size: 13px;
  font-weight: 600;
}
.first-column-setting > small {
  color: #948b9d;
  font-size: 11px;
}
.first-column-setting--dialog {
  grid-column: auto;
  margin-top: 14px;
  padding: 14px;
  background: #fcfbfd;
  border: 1px solid #ebe5ef;
  border-radius: 11px;
}
.create-chart-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 20px;
}
.create-chart-card__footer > span {
  color: #8d8497;
  font-size: 12px;
}
.create-chart-card__footer :deep(.el-button) {
  min-width: 140px;
}
@media (max-width: 980px) {
  .empty-chart__content {
    padding: 20px;
  }
  .create-chart-field {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .create-chart-field :deep(.student-source-selector) {
    justify-content: flex-start;
  }
  .first-column-setting {
    grid-column: 1;
  }
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
