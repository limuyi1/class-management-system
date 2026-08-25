<script setup lang="ts">
/** 值日表页面 — 分组、岗位、学生分配、组长设置和导出 */
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import StudentSourceSelector from '@/components/student-source/StudentSourceSelector.vue'
import UnassignedStudentPanel from '@/views/seating-chart/components/UnassignedStudentPanel.vue'
import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { DutyRosterModeEnum } from '@/types/DutyRoster'
import { findDutySectionByPosition } from '@/utils/duty-roster/dutyRosterUtil'
import DutyNotesPanel from '@/views/duty-roster/components/DutyNotesPanel.vue'
import DutyPositionContextMenu from '@/views/duty-roster/components/DutyPositionContextMenu.vue'
import DutyRosterEmptyState from '@/views/duty-roster/components/DutyRosterEmptyState.vue'
import DutyRosterExportDialog from '@/views/duty-roster/components/DutyRosterExportDialog.vue'
import DutyRosterSidebar from '@/views/duty-roster/components/DutyRosterSidebar.vue'
import DutyRosterToolbar from '@/views/duty-roster/components/DutyRosterToolbar.vue'
import DutyScheduleMatrix from '@/views/duty-roster/components/DutyScheduleMatrix.vue'
import DutySectionDialog from '@/views/duty-roster/components/DutySectionDialog.vue'
import DutyStudentContextMenu from '@/views/duty-roster/components/DutyStudentContextMenu.vue'
import DutyStudentImportDialog from '@/views/duty-roster/components/DutyStudentImportDialog.vue'

import type { DutyAssignmentTargetType } from '@/types/DutyRoster'
import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

/** 右键菜单坐标 */
interface MenuPositionType {
  x: number
  y: number
}

/** 岗位右键菜单状态 */
interface PositionMenuType extends MenuPositionType {
  positionId: string
}

/** 学生右键菜单状态 */
interface StudentMenuType extends MenuPositionType {
  studentId: string
}

const router = useRouter()
const dataSourceStore = useDataSourceStore()
const dutyStore = useDutyRosterStore()
const { activeStudents, assignedCount, editingRoster, unassignedStudents } = storeToRefs(dutyStore)

// 页面 UI 状态：矩阵引用、全屏、拖拽、弹窗与右键菜单等
const matrixRef = shallowRef<InstanceType<typeof DutyScheduleMatrix> | null>(null)
const fullscreen = shallowRef(false)
const draggedStudentId = shallowRef<string | null>(null)
const exportVisible = shallowRef(false)
const importVisible = shallowRef(false)
const importTarget = shallowRef<'create' | 'replace'>('create')
const sectionsVisible = shallowRef(false)
const notesVisible = shallowRef(false)
const notesDraft = shallowRef('')
const positionMenu = shallowRef<PositionMenuType | null>(null)
const studentMenu = shallowRef<StudentMenuType | null>(null)
// 新建值日表的默认安排方式与名单来源
const initialMode = shallowRef(DutyRosterModeEnum.Daily)
const initialSource = shallowRef<StudentSourceType>(
  dataSourceStore.enabledData.length ? 'system' : 'excel'
)
const initialExcelSource = shallowRef<ExcelStudentSourceType | null>(null)

/** 学生 ID 到姓名的映射，供矩阵与导出使用 */
const studentNames = computed<Record<string, string>>(() =>
  Object.fromEntries(activeStudents.value.map((student) => [student.id, student.name]))
)
/** 右键菜单所指向岗位所属的清洁区域 */
const currentPositionSection = computed(() => {
  if (!editingRoster.value || !positionMenu.value) return null
  return findDutySectionByPosition(editingRoster.value, positionMenu.value.positionId) || null
})
/** 仅当区域内有多个岗位时才允许删除当前列 */
const canRemovePosition = computed(() =>
  Boolean(currentPositionSection.value && currentPositionSection.value.positions.length > 1)
)
/** 右键菜单指向的学生是否为组长 */
const menuStudentIsLeader = computed(() =>
  Boolean(
    editingRoster.value?.leaders.some((leader) => leader.studentId === studentMenu.value?.studentId)
  )
)

// 学生数据源变化时重新校准名单，并同步“新建值日表”的默认来源
watch(
  () => dataSourceStore.enabledData.map((student) => student.studentId).join(','),
  () => {
    dutyStore.reconcileStudents()
    // 已有值日表或已上传 Excel 名单时，不覆盖用户当前选择
    if (!editingRoster.value && !initialExcelSource.value) {
      initialSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
    }
  }
)

onMounted(() => {
  dutyStore.reconcileStudents()
  document.addEventListener('click', closeContextMenus)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenus)
  window.removeEventListener('keydown', handleKeydown)
})

/** 关闭所有右键菜单 */
function closeContextMenus(): void {
  positionMenu.value = null
  studentMenu.value = null
}

/**
 * 处理键盘快捷键：Esc 退出全屏并关闭右键菜单。
 * @param event - 键盘事件
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && fullscreen.value) fullscreen.value = false
  if (event.key === 'Escape') closeContextMenus()
}

/** 返回工具页面 */
function backToTools(): void {
  router.push('/tools')
}

/** 进入新建值日表流程，重置默认模式与名单来源 */
function startCreatingRoster(): void {
  initialMode.value = DutyRosterModeEnum.Daily
  initialExcelSource.value = null
  initialSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
  dutyStore.startCreatingRoster()
}

/** 根据所选模式与名单来源创建值日表；Excel 未上传时先打开导入弹窗 */
function createInitialRoster(): void {
  if (initialSource.value === 'excel' && !initialExcelSource.value) {
    importTarget.value = 'create'
    importVisible.value = true
    return
  }
  dutyStore.createRoster({
    mode: initialMode.value,
    studentSource: initialSource.value,
    excelSource: initialExcelSource.value || undefined
  })
}

/** 切换到指定值日表并关闭右键菜单 */
function selectRoster(rosterId: string): void {
  dutyStore.setEditingRoster(rosterId)
  closeContextMenus()
}

/**
 * 弹窗重命名指定值日表。
 * @param rosterId - 值日表 ID
 */
async function renameRoster(rosterId: string): Promise<void> {
  const roster = dutyStore.rosters.find((item) => item.id === rosterId)
  if (!roster) return
  const { value } = await ElMessageBox.prompt('请输入值日表名称', '重命名', {
    inputValue: roster.name,
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空'
  })
  dutyStore.renameRoster(rosterId, value)
}

/**
 * 二次确认后删除指定值日表。
 * @param rosterId - 值日表 ID
 */
async function removeRoster(rosterId: string): Promise<void> {
  await ElMessageBox.confirm('删除后无法恢复该值日表，是否继续？', '删除值日表', {
    type: 'warning'
  })
  dutyStore.deleteRoster(rosterId)
}

/**
 * 切换安排方式（每天/每周），已有安排时先二次确认清空。
 * @param mode - 目标安排方式
 */
async function changeMode(mode: DutyRosterModeEnum): Promise<void> {
  // 未进入编辑或模式未变化时无需处理
  if (!editingRoster.value || editingRoster.value.mode === mode) return
  if (assignedCount.value) {
    try {
      await ElMessageBox.confirm(
        '切换安排方式后，当前学生安排将被清空。是否继续？',
        '切换安排方式',
        {
          type: 'warning'
        }
      )
    } catch {
      return
    }
  }
  dutyStore.setMode(mode)
}

/**
 * 已有安排时二次确认是否清空值日安排。
 * @returns 无已安排学生或用户确认时返回 true
 */
async function confirmClearAssignments(): Promise<boolean> {
  // 没有已安排学生时无需确认
  if (!assignedCount.value) return true
  try {
    await ElMessageBox.confirm('更换学生来源后，当前值日安排将被清空。是否继续？', '更换名单来源', {
      type: 'warning'
    })
    return true
  } catch {
    return false
  }
}

/**
 * 切换当前值日表的学生来源；Excel 来源未上传文件时先打开导入弹窗。
 * @param source - 目标学生来源
 */
async function changeStudentSource(source: StudentSourceType): Promise<void> {
  // 未进入编辑或来源未变化时无需处理
  if (!editingRoster.value || editingRoster.value.studentSource === source) return
  if (!(await confirmClearAssignments())) return
  if (source === 'excel' && !editingRoster.value.excelSource) {
    importTarget.value = 'replace'
    importVisible.value = true
    return
  }
  dutyStore.setStudentSource(source, editingRoster.value.excelSource)
}

/** 打开 Excel 名单导入弹窗，已有值日表时先确认清空影响 */
async function openStudentImport(): Promise<void> {
  if (editingRoster.value && !(await confirmClearAssignments())) return
  importTarget.value = editingRoster.value ? 'replace' : 'create'
  importVisible.value = true
}

/**
 * 处理 Excel 名单导入结果：替换当前来源，或作为新建值日表的初始名单。
 * @param source - 导入得到的 Excel 学生来源
 */
function handleStudentImport(source: ExcelStudentSourceType): void {
  if (importTarget.value === 'replace' && editingRoster.value) {
    dutyStore.setStudentSource('excel', source)
  } else {
    initialExcelSource.value = source
    initialSource.value = 'excel'
  }
  ElMessage.success(`已导入 ${source.students.length} 名学生`)
}

/** 开始拖拽学生，并关闭右键菜单 */
function dragStudent(studentId: string): void {
  draggedStudentId.value = studentId
  closeContextMenus()
}

/** 结束学生拖拽 */
function endStudentDrag(): void {
  draggedStudentId.value = null
}

/**
 * 将拖拽中的学生分配到指定岗位。
 * @param target - 值日分配目标
 */
function dropStudent(target: DutyAssignmentTargetType): void {
  if (!draggedStudentId.value) return
  dutyStore.assignStudent(draggedStudentId.value, target)
  draggedStudentId.value = null
}

/** 将拖拽中的学生移回未安排区域 */
function dropToUnassigned(): void {
  if (draggedStudentId.value) dutyStore.unassignStudent(draggedStudentId.value)
  draggedStudentId.value = null
}

/**
 * 打开岗位右键菜单。
 * @param positionId - 岗位 ID
 * @param x - 菜单横坐标
 * @param y - 菜单纵坐标
 */
function openPositionMenu(positionId: string, x: number, y: number): void {
  studentMenu.value = null
  positionMenu.value = { positionId, x, y }
}

/**
 * 打开学生右键菜单。
 * @param studentId - 学生 ID
 * @param x - 菜单横坐标
 * @param y - 菜单纵坐标
 */
function openStudentMenu(studentId: string, x: number, y: number): void {
  positionMenu.value = null
  studentMenu.value = { studentId, x, y }
}

/** 在右键菜单指向的岗位后新增一列，并进入重命名状态 */
async function addPosition(): Promise<void> {
  const target = positionMenu.value
  const section = currentPositionSection.value
  if (!target || !section) return
  const positionId = dutyStore.addPosition(section.id, target.positionId)
  closeContextMenus()
  if (!positionId) return
  await nextTick()
  await matrixRef.value?.editPosition(positionId)
}

/** 删除右键菜单指向的岗位，已有学生时先二次确认 */
async function removePosition(): Promise<void> {
  const target = positionMenu.value
  if (!target || !canRemovePosition.value) return
  const count = dutyStore.getPositionStudentCount(target.positionId)
  if (count) {
    try {
      await ElMessageBox.confirm(
        `该岗位已有 ${count} 名学生，删除后学生将回到未安排区域。是否继续？`,
        '删除岗位',
        { type: 'warning' }
      )
    } catch {
      return
    }
  }
  dutyStore.removePosition(target.positionId)
  closeContextMenus()
}

/** 在周模式下新增一值日行 */
function addWeeklyRow(): void {
  dutyStore.addWeeklyRow()
}

/**
 * 删除指定值日行，已有学生时先二次确认。
 * @param rowId - 值日行 ID
 */
async function removeWeeklyRow(rowId: string): Promise<void> {
  const count = dutyStore.getWeeklyRowStudentCount(rowId)
  if (count) {
    try {
      await ElMessageBox.confirm(
        `该行已有 ${count} 名学生，删除后学生将回到未安排区域。是否继续？`,
        '删除值日行',
        { type: 'warning' }
      )
    } catch {
      return
    }
  }
  dutyStore.removeWeeklyRow(rowId)
}

/** 切换右键菜单学生的组长状态 */
function toggleMenuStudentLeader(): void {
  if (studentMenu.value) dutyStore.toggleLeader(studentMenu.value.studentId)
  closeContextMenus()
}

/** 将右键菜单学生移出值日表 */
function removeMenuStudent(): void {
  if (studentMenu.value) dutyStore.unassignStudent(studentMenu.value.studentId)
  closeContextMenus()
}

/** 弹窗新增清洁区域 */
async function addSection(): Promise<void> {
  const { value } = await ElMessageBox.prompt('例如：室外、公共区域', '新增清洁区域', {
    inputValue: '清洁区域',
    inputPattern: /\S+/,
    inputErrorMessage: '区域名称不能为空'
  })
  dutyStore.addSection(value)
}

/** 打开备注编辑弹窗并回填当前备注 */
function editNotes(): void {
  notesDraft.value = editingRoster.value?.notes || ''
  notesVisible.value = true
}

/** 保存备注并关闭弹窗 */
function saveNotes(): void {
  dutyStore.setNotes(notesDraft.value)
  notesVisible.value = false
}
</script>

<template>
  <div class="duty-roster-page app-page-shell" :class="{ fullscreen }">
    <PageHeader
      v-if="!fullscreen"
      :icon="['solid', 'broom']"
      title="值日表"
      subtitle="安排每日或整周清洁岗位，打印后可直接张贴"
    >
      <template #left>
        <el-button size="small" circle aria-label="返回工具" @click="backToTools">
          <font-awesome-icon :icon="['solid', 'arrow-left']" />
        </el-button>
      </template>
    </PageHeader>

    <div
      class="duty-workspace"
      :class="{
        'has-roster': Boolean(editingRoster),
        'is-collapsed': dutyStore.isSidebarCollapsed
      }"
    >
      <!-- 侧边栏：值日表方案列表 -->
      <DutyRosterSidebar
        :rosters="dutyStore.rosters"
        :editing-roster-id="dutyStore.editingRosterId"
        :collapsed="dutyStore.isSidebarCollapsed"
        @select="selectRoster"
        @create="startCreatingRoster"
        @copy="dutyStore.copyRoster"
        @rename="renameRoster"
        @remove="removeRoster"
        @toggle-collapse="dutyStore.setSidebarCollapsed(!dutyStore.isSidebarCollapsed)"
      />

      <!-- 主编辑区：工具栏、排班矩阵与备注 -->
      <main class="duty-editor">
        <template v-if="editingRoster">
          <DutyRosterToolbar
            :roster-name="editingRoster.name"
            :mode="editingRoster.mode"
            :fullscreen="fullscreen"
            @rename="dutyStore.renameRoster(editingRoster.id, $event)"
            @change-mode="changeMode"
            @manage-sections="sectionsVisible = true"
            @export="exportVisible = true"
            @toggle-fullscreen="fullscreen = !fullscreen"
          />

          <div class="duty-editor__content">
            <DutyScheduleMatrix
              ref="matrixRef"
              :roster="editingRoster"
              :student-names="studentNames"
              @rename-position="dutyStore.renamePosition"
              @position-context="openPositionMenu"
              @student-context="openStudentMenu"
              @drag-student-start="dragStudent"
              @drag-student-end="endStudentDrag"
              @drop-student="dropStudent"
              @reorder-position="dutyStore.reorderPosition"
              @add-weekly-row="addWeeklyRow"
              @remove-weekly-row="removeWeeklyRow"
            />
            <DutyNotesPanel :notes="editingRoster.notes" @edit="editNotes" />
          </div>
        </template>

        <!-- 空状态：选择安排方式与名单来源创建值日表 -->
        <template v-else>
          <div class="duty-empty-source">
            <StudentSourceSelector
              :source="initialSource"
              :system-student-count="dataSourceStore.enabledData.length"
              :excel-file-name="initialExcelSource?.fileName"
              :excel-student-count="initialExcelSource?.students.length"
              @change="initialSource = $event"
              @upload="openStudentImport"
            />
          </div>
          <DutyRosterEmptyState
            :mode="initialMode"
            :source="initialSource"
            :has-excel-source="Boolean(initialExcelSource)"
            @update-mode="initialMode = $event"
            @create="createInitialRoster"
          />
        </template>
      </main>

      <!-- 未安排学生面板：拖拽学生到值日岗位 -->
      <UnassignedStudentPanel
        v-if="editingRoster"
        :students="unassignedStudents"
        :total-student-count="activeStudents.length"
        :selected-student-id="null"
        interaction-tip="拖拽学生到对应值日岗位"
        complete-description="所有学生都已安排到值日岗位"
        @drag-start="dragStudent"
        @drag-end="endStudentDrag"
        @drop-to-unassigned="dropToUnassigned"
      >
        <template #source>
          <StudentSourceSelector
            :source="editingRoster.studentSource"
            :system-student-count="dataSourceStore.enabledData.length"
            :excel-file-name="editingRoster.excelSource?.fileName"
            :excel-student-count="editingRoster.excelSource?.students.length"
            @change="changeStudentSource"
            @upload="openStudentImport"
          />
        </template>
      </UnassignedStudentPanel>
    </div>

    <!-- 岗位/学生右键菜单与区域、导入、导出、备注弹窗 -->
    <DutyPositionContextMenu
      v-if="positionMenu"
      :x="positionMenu.x"
      :y="positionMenu.y"
      :can-remove="canRemovePosition"
      @add="addPosition"
      @remove="removePosition"
    />
    <DutyStudentContextMenu
      v-if="studentMenu"
      :x="studentMenu.x"
      :y="studentMenu.y"
      :is-leader="menuStudentIsLeader"
      @toggle-leader="toggleMenuStudentLeader"
      @remove="removeMenuStudent"
    />

    <DutySectionDialog
      v-if="editingRoster"
      :model-value="sectionsVisible"
      :sections="editingRoster.sections"
      @update:model-value="sectionsVisible = $event"
      @rename="dutyStore.renameSection"
      @reorder="dutyStore.reorderSections"
      @remove="dutyStore.removeSection"
      @add="addSection"
    />
    <DutyStudentImportDialog
      :model-value="importVisible"
      @update:model-value="importVisible = $event"
      @confirm="handleStudentImport"
    />
    <DutyRosterExportDialog
      v-if="editingRoster"
      :model-value="exportVisible"
      :roster="editingRoster"
      :student-names="studentNames"
      @update:model-value="exportVisible = $event"
    />

    <el-dialog v-model="notesVisible" title="编辑备注说明" width="620px">
      <el-input
        v-model="notesDraft"
        type="textarea"
        :rows="8"
        resize="none"
        placeholder="每行填写一条说明"
      />
      <template #footer>
        <el-button @click="notesVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNotes">保存说明</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.duty-roster-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.duty-workspace {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  min-height: 650px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5dfed;
  border-radius: 16px;
  box-shadow: 0 14px 38px rgba(50, 35, 81, 0.07);
}

.duty-workspace.has-roster {
  grid-template-columns: 210px minmax(0, 1fr) 270px;
}

.duty-workspace.is-collapsed {
  grid-template-columns: 62px minmax(0, 1fr);
}

.duty-workspace.is-collapsed.has-roster {
  grid-template-columns: 62px minmax(0, 1fr) 270px;
}

.duty-editor {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.duty-editor__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding: 10px 12px;
  overflow: auto;
}

.duty-empty-source {
  display: flex;
  justify-content: flex-end;
  padding: 13px 16px 0;
}

.duty-roster-page.fullscreen {
  position: fixed;
  z-index: 2000;
  inset: 0;
  padding: 12px;
  background: #f5f3f8;
}

.fullscreen .duty-workspace {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
}

@media (max-width: 1180px) {
  .duty-workspace.has-roster,
  .duty-workspace.is-collapsed.has-roster {
    grid-template-columns: 62px minmax(0, 1fr) 248px;
  }
}
</style>
