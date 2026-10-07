<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import ExcelStudentRosterDialog from '@/components/student-source/ExcelStudentRosterDialog.vue'
import StudentSourceSelector from '@/components/student-source/StudentSourceSelector.vue'
import UnassignedStudentPanel from '@/views/seating-chart/components/UnassignedStudentPanel.vue'
import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import DutyAutoAssignDialog from './components/DutyAutoAssignDialog.vue'
import DutyNotesPanel from '@/views/duty-roster/components/DutyNotesPanel.vue'
import DutyPositionContextMenu from '@/views/duty-roster/components/DutyPositionContextMenu.vue'
import DutyRosterEmptyState from '@/views/duty-roster/components/DutyRosterEmptyState.vue'
import DutyRosterExportDialog from '@/views/duty-roster/components/DutyRosterExportDialog.vue'
import DutyRosterSidebar from '@/views/duty-roster/components/DutyRosterSidebar.vue'
import DutyRosterToolbar from '@/views/duty-roster/components/DutyRosterToolbar.vue'
import DutyScheduleMatrix from '@/views/duty-roster/components/DutyScheduleMatrix.vue'
import DutySectionDialog from '@/views/duty-roster/components/DutySectionDialog.vue'
import DutySectionLeaderDialog from '@/views/duty-roster/components/DutySectionLeaderDialog.vue'
import DutyStudentContextMenu from '@/views/duty-roster/components/DutyStudentContextMenu.vue'
import DutyStudentImportDialog from '@/views/duty-roster/components/DutyStudentImportDialog.vue'
import { useDutyRosterInteraction } from '@/views/duty-roster/composables/useDutyRosterInteraction'
import { useDutyRosterStudents } from '@/views/duty-roster/composables/useDutyRosterStudents'

const interaction = useDutyRosterInteraction()

const {
  matrixRef,
  fullscreen,
  positionMenu,
  studentMenu,
  canRemovePosition,
  menuStudentIsLeader,
  canDeletePendingCard,
  dragPendingStudent,
  dragAssignedStudent,
  endStudentDrag,
  dropStudent,
  dropToUnassigned,
  openPositionMenu,
  openAssignedStudentMenu,
  openPendingStudentMenu,
  addPosition,
  removePosition,
  addWeeklyRow,
  removeWeeklyRow,
  copyMenuStudent,
  deleteMenuStudent,
  removeMenuStudent,
  toggleMenuStudentLeader
} = interaction

const {
  importVisible,
  initialMode,
  initialSource,
  initialExcelSource,
  startCreatingRoster,
  createInitialRoster,
  selectRoster,
  renameRoster,
  removeRoster,
  changeMode,
  changeStudentSource,
  openStudentImport,
  handleStudentImport,
  addExcelStudent,
  removeExcelStudent
} = useDutyRosterStudents(interaction)

const router = useRouter()

const dataSourceStore = useDataSourceStore()

const dutyStore = useDutyRosterStore()

const { activeStudents, editingRoster, pendingStudentCounts, unassignedStudents } =
  storeToRefs(dutyStore)

const autoAssignVisible = shallowRef(false)
const exportVisible = shallowRef(false)

const studentRosterVisible = shallowRef(false)

const sectionsVisible = shallowRef(false)

const leaderSectionId = shallowRef<string | null>(null)

const notesVisible = shallowRef(false)

const notesDraft = shallowRef('')

/** 学生 ID 到姓名的映射，供矩阵与导出使用 */
const studentNames = computed<Record<string, string>>(() =>
  Object.fromEntries(activeStudents.value.map((student) => [student.id, student.name]))
)

/** 当前正在设置大组长的区域。 */
const leaderSection = computed(() =>
  editingRoster.value?.sections.find((section) => section.id === leaderSectionId.value)
)

/** 返回工具页面 */
function backToTools(): void {
  router.push('/tools')
}

/** 打开区域顶部大组长设置。 */
function editSectionLeader(sectionId: string): void {
  leaderSectionId.value = sectionId
}

/** 保存区域顶部大组长，不影响下方每日组长。 */
function saveSectionLeader(studentId?: string): void {
  if (leaderSectionId.value) dutyStore.setSectionLeader(leaderSectionId.value, studentId)
  leaderSectionId.value = null
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
    <DutyAutoAssignDialog v-model="autoAssignVisible" />
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
            @auto-assign="autoAssignVisible = true"
            @export="exportVisible = true"
            @toggle-fullscreen="fullscreen = !fullscreen"
          />

          <el-scrollbar class="app-scroll-region app-scroll-region--fill" height="100%"
            ><div class="duty-editor__content">
              <DutyScheduleMatrix
                ref="matrixRef"
                :roster="editingRoster"
                :student-names="studentNames"
                @rename-position="dutyStore.renamePosition"
                @position-context="openPositionMenu"
                @student-context="openAssignedStudentMenu"
                @drag-student-start="dragAssignedStudent"
                @drag-student-end="endStudentDrag"
                @drop-student="dropStudent"
                @reorder-position="dutyStore.reorderPosition"
                @add-weekly-row="addWeeklyRow"
                @remove-weekly-row="removeWeeklyRow"
                @edit-section-leader="editSectionLeader"
              />
              <DutyNotesPanel :notes="editingRoster.notes" @edit="editNotes" /></div
          ></el-scrollbar>
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

      <!-- 待选学生面板：右键复制/删除卡片，拖拽卡片到值日岗位 -->
      <UnassignedStudentPanel
        v-if="editingRoster"
        :students="unassignedStudents"
        :total-student-count="activeStudents.length"
        :selected-student-id="null"
        :student-counts="pendingStudentCounts"
        interaction-tip="拖拽安排，右键复制或删除"
        complete-description="所有学生都已安排到值日岗位"
        @drag-start="dragPendingStudent"
        @drag-end="endStudentDrag"
        @student-context="openPendingStudentMenu"
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
          >
            <template v-if="editingRoster.studentSource === 'excel'" #actions>
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
          </StudentSourceSelector>
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
      :location="studentMenu.location"
      :can-delete="canDeletePendingCard"
      :is-leader="menuStudentIsLeader"
      @copy="copyMenuStudent"
      @delete="deleteMenuStudent"
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
    <DutySectionLeaderDialog
      v-if="editingRoster && leaderSection"
      :model-value="Boolean(leaderSectionId)"
      :section-name="leaderSection.name"
      :students="activeStudents"
      :leader-student-id="leaderSection.leaderStudentId"
      @update:model-value="leaderSectionId = $event ? leaderSectionId : null"
      @confirm="saveSectionLeader"
    />
    <DutyStudentImportDialog
      :model-value="importVisible"
      @update:model-value="importVisible = $event"
      @confirm="handleStudentImport"
    />
    <ExcelStudentRosterDialog
      v-if="editingRoster?.studentSource === 'excel' && editingRoster.excelSource"
      v-model="studentRosterVisible"
      scope-label="当前值日表"
      :students="editingRoster.excelSource.students"
      :assigned-student-ids="dutyStore.assignedStudentIds"
      @add="addExcelStudent"
      @remove="removeExcelStudent"
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
  overflow: visible;
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
