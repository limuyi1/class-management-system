<script setup lang="ts">
import { ref, shallowRef } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import SeatingRotationDialog from './components/SeatingRotationDialog.vue'
import SeatingChartSidebar from './components/SeatingChartSidebar.vue'
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
import { SeatingFirstColumnSideEnum } from '@/types/SeatingChart'
import {
  SEATING_CHART_MAX_SIZE,
  SEATING_CHART_MIN_SIZE
} from '@/utils/seating-chart/seatingChartUtil'
import { useSeatingChartInteraction } from '@/views/seating-chart/composables/useSeatingChartInteraction'
import { useSeatingChartStudents } from '@/views/seating-chart/composables/useSeatingChartStudents'
import { useSeatingChartLayout } from '@/views/seating-chart/composables/useSeatingChartLayout'
import { useSeatingChartRandomization } from '@/views/seating-chart/composables/useSeatingChartRandomization'

const interaction = useSeatingChartInteraction()

const {
  fullscreen,
  draggedStudentId,
  selectedStudentId,
  studentMenu,
  studentNames,
  studentNameRecord,
  menuStudentName,
  menuAssignedRoleIds,
  roleManagementVisible,
  dropOnSeat,
  selectSeat,
  dropToUnassigned,
  toggleSpecialSeat,
  dropOnSpecialSeat,
  selectSpecialSeat,
  openStudentMenu,
  toggleMenuStudentRole,
  manageRolesFromMenu,
  saveRoleSettings,
  toggleFullscreen
} = interaction

const {
  studentImportVisible,
  initialStudentSource,
  initialExcelSource,
  initialLayout,
  managedAssignedStudentIds,
  createChart,
  createInitialChart,
  handleStudentSourceChange,
  openStudentImport,
  openInitialStudentImport,
  handleInitialStudentSourceChange,
  handleExcelStudentImport,
  addExcelStudent,
  removeExcelStudent,
  selectChart,
  renameChart,
  deleteChart
} = useSeatingChartStudents(interaction)

const {
  layoutVisible,
  aisleVisible,
  layout,
  aisles,
  visibleSeatRows,
  openLayout,
  confirmLayout,
  openAisles,
  saveAisles
} = useSeatingChartLayout()

const {
  randomModeVisible,
  previewVisible,
  preview,
  randomize,
  randomizeAll,
  generatePreview,
  openSupplement,
  applyPreview
} = useSeatingChartRandomization()

const router = useRouter()

const seatingStore = useSeatingChartStore()

const dataSourceStore = useDataSourceStore()

// 座位表 store 的响应式数据；editingChart 为当前编辑中的座位表
const { activeStudents, editingChart, unassignedStudents, assignedCount, seatCapacity } =
  storeToRefs(seatingStore)

const rotationVisible = ref(false)
const specialSeatVisible = ref(false)

const exportVisible = shallowRef(false)

const studentRosterVisible = shallowRef(false)

const notesVisible = shallowRef(false)

const notesDraft = ref('')

/** 返回工具页面 */
function backToTools(): void {
  router.push('/tools')
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
</script>

<template>
  <div class="seating-chart-page app-page-shell" :class="{ fullscreen }">
    <SeatingRotationDialog v-model="rotationVisible" />
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
      <SeatingChartSidebar
        :charts="seatingStore.charts"
        :active-chart-id="editingChart?.id"
        :collapsed="seatingStore.isSidebarCollapsed"
        @toggle-collapsed="seatingStore.setSidebarCollapsed(!seatingStore.isSidebarCollapsed)"
        @select="selectChart"
        @copy="seatingStore.copyChart"
        @rename="renameChart"
        @delete="deleteChart"
        @create="createChart"
      />
      <!-- 中间：座位表编辑区（工具栏 + 座位画布） -->
      <main v-if="editingChart" class="chart-editor">
        <seating-chart-toolbar
          :chart-name="editingChart.name"
          :assigned-count="assignedCount"
          :seat-capacity="seatCapacity"
          :platform-position="editingChart.platformPosition"
          :fullscreen="fullscreen"
          @open-layout="openLayout"
          @open-aisles="openAisles"
          @open-special-seats="specialSeatVisible = true"
          @manage-roles="roleManagementVisible = true"
          @change-platform-position="seatingStore.setPlatformPosition($event)"
          @randomize="randomize"
          @rotate="rotationVisible = true"
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

<style scoped lang="scss" src="./styles/seating-chart-page.scss"></style>
