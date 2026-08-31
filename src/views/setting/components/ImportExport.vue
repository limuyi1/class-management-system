<script setup lang="ts">
/**
 * 数据导入导出页：提供 .dexie 全量备份导出/恢复、Excel 学生初始化/增量成绩导入，
 * 以及清空全部数据的能力，并展示最近备份状态。
 */
import { computed, nextTick, onMounted, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { ElMessageBox, dayjs } from 'element-plus'

import router from '@/router'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useStudentDataImport } from '@/hooks/useStudentDataImport'
import ExcelColumnConflictDialog from '@/components/ExcelColumnConflictDialog.vue'
import ExcelColumnSelector from '@/components/ExcelColumnSelector.vue'
import { clearDatabase, exportDatabase, getDaysSinceBackup, importDatabase } from '@/utils/backup'
import ImportActionMenu from '@/views/setting/components/import/ImportActionMenu.vue'
import InitialImportDialog from '@/views/setting/components/import/InitialImportDialog.vue'
import ImportProgress from './ImportProgress.vue'

const route = useRoute()

const exporting = ref(false) // 导出进行中
const importingBackup = ref(false) // 备份导入进行中
const backupFileInputRef = ref<HTMLInputElement | null>(null) // .dexie 恢复专用文件入口
const progressVisible = ref(false) // 进度弹窗显隐
const progressTitle = ref('') // 进度弹窗标题
const progressPercent = ref(0) // 进度百分比（0-100）

const dataSourceStore = useDataSourceStore()
const { students } = storeToRefs(dataSourceStore)
/** 是否已有学生数据，决定导入按钮走初始化还是增量成绩 */
const hasStudentData = computed(() => students.value.length > 0)

const configurationStore = useConfigurationStore()
const { lastBackupAt } = storeToRefs(configurationStore)
/** 距离上次备份的天数 */
const daysSinceBackup = computed(() => getDaysSinceBackup(lastBackupAt.value))
/** 从未备份或超过 7 天未备份时视为逾期 */
const backupOverdue = computed(
  () => lastBackupAt.value === null || (daysSinceBackup.value ?? 0) >= 7
)
/** 上次备份时间的展示文本 */
const backupTimeText = computed(() => {
  if (!lastBackupAt.value) return '从未备份'
  return dayjs(lastBackupAt.value).format('YYYY-MM-DD HH:mm')
})

// 从学生信息页进入时定位到 Excel 导入区域。
onMounted(async () => {
  if (route.query.section !== 'excel-import') return
  await nextTick()
  document.getElementById('excel-import')?.scrollIntoView({ block: 'center' })
})

// 从学生导入 hook 解构 Excel 导入流程相关的状态与方法
const {
  excelFileInputRef,
  importingExcel,
  excelPreviewRows,
  excelPreviewMerges,
  suggestedHeaderRowIndex,
  excelHeaders,
  excelRows,
  initialDialogVisible,
  scoreColumnSelectorVisible,
  conflictDialogVisible,
  conflictColumns,
  triggerExcelImport,
  handleExcelFileChange,
  handleInitialConfirm,
  handleScoreColumnConfirm,
  handleConflictConfirm,
  resetExcelImport
} = useStudentDataImport()

/**
 * 更新进度条百分比。
 * @param percent - 进度值（0-100）
 */
const updateProgress = (percent: number) => {
  progressPercent.value = percent
}

/** 导出包含所有数据库表的完整 .dexie 系统备份。 */
const handleExport = async () => {
  exporting.value = true
  progressTitle.value = '正在导出数据'
  progressPercent.value = 0
  progressVisible.value = true

  try {
    await exportDatabase(updateProgress)
    progressPercent.value = 100
  } finally {
    // 延迟 500ms 再关闭弹窗，便于用户看到 100% 的完成态
    window.setTimeout(() => {
      progressVisible.value = false
    }, 500)
    exporting.value = false
  }
}

/** 打开完整系统备份文件选择器。 */
const triggerBackupImport = () => backupFileInputRef.value?.click()

/** 导入 .dexie 备份：确认覆盖后执行全量恢复，完成后跳转总览页 */
const handleBackupImport = async (file: File) => {
  try {
    await ElMessageBox.confirm('导入将覆盖当前所有数据，确定要继续吗？', '确认导入', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    importingBackup.value = true
    progressTitle.value = '正在导入数据'
    progressPercent.value = 0
    progressVisible.value = true
    await importDatabase(file, updateProgress, () => {
      progressPercent.value = 100
      window.setTimeout(() => {
        progressVisible.value = false
        void router.push('/overview')
      }, 500)
    })
  } catch {
    progressVisible.value = false
  } finally {
    importingBackup.value = false
  }
}

/**
 * 处理完整系统备份文件；该入口只接受 .dexie，避免与业务 Excel 混淆。
 */
const handleBackupFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  await handleBackupImport(file)
}

/** 清空全部数据：二次确认后执行，完成后跳转工具页 */
const handleClear = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有数据吗？此操作不可恢复！', '确认清空', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    })
    progressTitle.value = '正在清空数据'
    progressPercent.value = 0
    progressVisible.value = true
    await clearDatabase(updateProgress, () => {
      progressVisible.value = false
      void router.push('/tools')
    })
  } catch {
    progressVisible.value = false
  }
}
</script>

<template>
  <div class="import-export__wrapper">
    <el-card>
      <div class="import-export-title">数据导入导出</div>
      <p class="import-export-desc">
        .dexie 用于完整备份和恢复全部系统数据；Excel 仅用于批量建立学生名单或追加成绩。
      </p>

      <div class="import-export-actions">
        <!-- 导出数据：全量备份为 .dexie 文件 -->
        <div class="action-item">
          <div class="action-icon action-icon-export">
            <font-awesome-icon :icon="['solid', 'file-export']" />
          </div>
          <div class="action-info">
            <div class="action-label">导出完整系统备份</div>
            <div class="action-desc">
              包含学生、成绩、标签、值日表、座位表、错题本、配置、附件和排版数据
            </div>
            <div class="backup-status" :class="{ 'is-overdue': backupOverdue }">
              <font-awesome-icon
                :icon="['solid', backupOverdue ? 'triangle-exclamation' : 'circle-check']"
              />
              <span v-if="lastBackupAt === null">从未备份，建议尽快备份</span>
              <span v-else-if="backupOverdue">上次备份 {{ daysSinceBackup }} 天前，建议尽快备份</span>
              <span v-else>上次备份：{{ backupTimeText }}</span>
            </div>
          </div>
          <el-button type="primary" size="large" :loading="exporting" @click="handleExport">
            <template #icon><font-awesome-icon :icon="['solid', 'download']" /></template>
            导出
          </el-button>
        </div>

        <el-divider />

        <!-- 恢复完整系统备份：只接受 .dexie，恢复时覆盖当前全部数据 -->
        <div class="action-item">
          <div class="action-icon action-icon-import">
            <font-awesome-icon :icon="['solid', 'file-import']" />
          </div>
          <div class="action-info">
            <div class="action-label">恢复完整系统备份</div>
            <div class="action-desc">从 .dexie 恢复全部系统数据，并覆盖当前内容</div>
          </div>
          <el-button
            type="warning"
            size="large"
            :loading="importingBackup"
            @click="triggerBackupImport"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'rotate-left']" /></template>
            选择备份
          </el-button>
          <input
            ref="backupFileInputRef"
            type="file"
            accept=".dexie"
            hidden
            @change="handleBackupFileChange"
          />
        </div>

        <el-divider />

        <!-- 业务 Excel 导入：无学生数据走初始化，有数据则增量添加成绩 -->
        <div id="excel-import" class="action-item">
          <div class="action-icon action-icon-import">
            <font-awesome-icon :icon="['solid', 'file-excel']" />
          </div>
          <div class="action-info">
            <div class="action-label">Excel 数据导入</div>
            <div class="action-desc">
              {{
                hasStudentData
                  ? '按姓名匹配现有学生并追加成绩，不新增系统学生'
                  : '批量建立系统学生名单，可同时选择成绩列和评语列'
              }}
            </div>
          </div>
          <import-action-menu
            :has-student-data="hasStudentData"
            :loading="importingBackup || importingExcel"
            @initial="triggerExcelImport('initial')"
            @score="triggerExcelImport('score')"
          />
          <input
            ref="excelFileInputRef"
            type="file"
            accept=".xls,.xlsx"
            hidden
            @change="handleExcelFileChange"
          />
        </div>

        <el-divider />

        <!-- 清空全部数据（不可恢复） -->
        <div class="action-item">
          <div class="action-icon action-icon-clear">
            <font-awesome-icon :icon="['solid', 'trash']" />
          </div>
          <div class="action-info">
            <div class="action-label">清空数据</div>
            <div class="action-desc">删除所有数据，此操作不可恢复</div>
          </div>
          <el-button type="danger" size="large" @click="handleClear">
            <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
            清空
          </el-button>
        </div>
      </div>

      <div class="backup-tip">
        <font-awesome-icon :icon="['solid', 'circle-info']" />
        <span>
          .dexie 可完整恢复系统；Excel 不是备份文件，值日表和座位表成果 Excel 也不能在此恢复
        </span>
      </div>
    </el-card>

    <!-- 进度弹窗、初始化导入弹窗与列选择/冲突处理弹窗 -->
    <import-progress
      v-model:visible="progressVisible"
      :title="progressTitle"
      :percent="progressPercent"
    />
    <initial-import-dialog
      v-model="initialDialogVisible"
      :headers="excelHeaders"
      :rows="excelRows"
      :preview-rows="excelPreviewRows"
      :preview-merges="excelPreviewMerges"
      :suggested-header-row-index="suggestedHeaderRowIndex"
      @confirm="handleInitialConfirm"
    />
    <excel-column-selector
      v-model="scoreColumnSelectorVisible"
      mode="incremental"
      :headers="excelHeaders"
      :rows="excelRows"
      :preview-rows="excelPreviewRows"
      :preview-merges="excelPreviewMerges"
      :suggested-header-row-index="suggestedHeaderRowIndex"
      @confirm="handleScoreColumnConfirm"
    />
    <excel-column-conflict-dialog
      v-model="conflictDialogVisible"
      :columns="conflictColumns"
      @confirm="handleConflictConfirm"
      @cancel="resetExcelImport"
    />
  </div>
</template>

<style scoped lang="scss" src="./import/import-export.scss"></style>
