<script setup lang="ts">
/**
 * 数据导入导出页：提供 .dexie 全量备份导出/恢复、Excel 学生初始化/增量成绩导入，
 * 以及清空全部数据的能力，并展示最近备份状态。
 */
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
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

const exporting = ref(false)
const importingBackup = ref(false)
const progressVisible = ref(false)
const progressTitle = ref('')
const progressPercent = ref(0)

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

/** 导出 .dexie 备份：先询问是否包含试卷排版数据，再执行导出 */
const handleExport = async () => {
  let includePaperLayout = true

  try {
    await ElMessageBox.confirm(
      '本次导出是否包含试卷排版数据（附件、草稿、工具参数）？',
      '导出备份',
      {
        confirmButtonText: '包含',
        cancelButtonText: '不包含',
        type: 'info',
        distinguishCancelAndClose: true
      }
    )
  } catch (action) {
    // 取消导出时不包含排版数据，关闭弹窗则直接中止
    if (action === 'cancel') {
      includePaperLayout = false
    } else {
      return
    }
  }

  exporting.value = true
  progressTitle.value = '正在导出数据'
  progressPercent.value = 0
  progressVisible.value = true

  try {
    await exportDatabase(updateProgress, includePaperLayout)
    progressPercent.value = 100
  } finally {
    // 延迟 500ms 再关闭弹窗，便于用户看到 100% 的完成态
    window.setTimeout(() => {
      progressVisible.value = false
    }, 500)
    exporting.value = false
  }
}

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
 * Excel 与 Dexie 共用文件入口；文件后缀决定进入业务导入还是全量恢复。
 */
const handleImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (file.name.toLowerCase().endsWith('.dexie')) {
    input.value = ''
    await handleBackupImport(file)
    return
  }

  await handleExcelFileChange(event)
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
        Excel 可初始化学生名单或按姓名添加成绩；.dexie 用于全量备份与恢复。
      </p>

      <div class="import-export-actions">
        <div class="action-item">
          <div class="action-icon action-icon-export">
            <font-awesome-icon :icon="['solid', 'file-export']" />
          </div>
          <div class="action-info">
            <div class="action-label">导出数据</div>
            <div class="action-desc">
              将学生、配置、标签、错题本等数据导出为 .dexie 备份，可选试卷排版
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

        <div class="action-item">
          <div class="action-icon action-icon-import">
            <font-awesome-icon :icon="['solid', 'file-import']" />
          </div>
          <div class="action-info">
            <div class="action-label">导入数据</div>
            <div class="action-desc">
              {{
                hasStudentData
                  ? '按姓名添加成绩，也可以使用 .dexie 恢复全量备份'
                  : '从 Excel 创建学生，可同时选择成绩列和评语列'
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
            accept=".dexie,.xls,.xlsx"
            hidden
            @change="handleImportFileChange"
          />
        </div>

        <el-divider />

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
        <span>.dexie 恢复会覆盖当前数据；评语 Excel 请在“工具 → 评语处理”中使用</span>
      </div>
    </el-card>

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
