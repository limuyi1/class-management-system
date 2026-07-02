<script setup lang="ts">
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { ElMessageBox } from 'element-plus'

import router from '@/router'
import { useDataSourceStore } from '@/stores/data-source'
import { useStudentDataImport } from '@/hooks/useStudentDataImport'
import ExcelColumnConflictDialog from '@/components/ExcelColumnConflictDialog.vue'
import ExcelColumnSelector from '@/components/ExcelColumnSelector.vue'
import { clearDatabase, exportDatabase, importDatabase } from '@/utils/backup'
import CommentImportDialog from '@/views/setting/components/import/CommentImportDialog.vue'
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
const hasStudentData = computed(() => students.value.length > 0)

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
  commentDialogVisible,
  conflictDialogVisible,
  conflictColumns,
  triggerExcelImport,
  handleExcelFileChange,
  handleInitialConfirm,
  handleScoreColumnConfirm,
  handleCommentConfirm,
  handleConflictConfirm,
  resetExcelImport
} = useStudentDataImport()

const updateProgress = (percent: number) => {
  progressPercent.value = percent
}

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
    window.setTimeout(() => {
      progressVisible.value = false
    }, 500)
    exporting.value = false
  }
}

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
        Excel 可初始化学生名单，或按姓名添加成绩和期末评语；.dexie 用于全量备份与恢复。
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
                  ? '按姓名添加成绩或评语，也可以使用 .dexie 恢复全量备份'
                  : '从 Excel 创建学生，可同时选择成绩列和评语列'
              }}
            </div>
          </div>
          <import-action-menu
            :has-student-data="hasStudentData"
            :loading="importingBackup || importingExcel"
            @initial="triggerExcelImport('initial')"
            @score="triggerExcelImport('score')"
            @comment="triggerExcelImport('comment')"
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
        <span>.dexie 恢复会覆盖当前数据；Excel 空白评语不会覆盖已有内容</span>
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
    <comment-import-dialog
      v-model="commentDialogVisible"
      :headers="excelHeaders"
      :rows="excelRows"
      :preview-rows="excelPreviewRows"
      :preview-merges="excelPreviewMerges"
      :suggested-header-row-index="suggestedHeaderRowIndex"
      @confirm="handleCommentConfirm"
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
