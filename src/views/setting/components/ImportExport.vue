<script setup lang="ts">
import { ref } from 'vue'

import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'

import router from '@/router'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import ExcelColumnConflictDialog from '@/components/ExcelColumnConflictDialog.vue'
import ExcelColumnSelector from '@/components/ExcelColumnSelector.vue'
import { exportDatabase, importDatabase, clearDatabase } from '@/utils/backup'
import { parseExcel } from '@/utils/xlsxUntil'
import {
  buildIncrementalScoreImport,
  findDuplicateNames,
  getConflictLabels
} from '@/utils/scoreImportUntil'
import ImportProgress from './ImportProgress.vue'
import { NAME_PROP } from '@/types/Constants'
import type { ConflictActionType, ExcelRowType } from '@/utils/scoreImportUntil'

const fileInput = ref<HTMLInputElement | null>(null)
const exporting = ref(false)
const importing = ref(false)
const importingExcel = ref(false)

const progressVisible = ref(false)
const progressTitle = ref('')
const progressPercent = ref(0)
const columnSelectorVisible = ref(false)
const conflictDialogVisible = ref(false)
const excelHeaders = ref<string[]>([])
const excelRows = ref<ExcelRowType[]>([])
const pendingScoreColumns = ref<string[]>([])
const conflictColumns = ref<string[]>([])

const dataSourceStore = useDataSourceStore()
const settingStore = useSettingStore()
const configurationStore = useConfigurationStore()
const { items } = storeToRefs(dataSourceStore)
const { tableHeaders } = storeToRefs(settingStore)

const updateProgress = (percent: number) => {
  progressPercent.value = percent
}

const handleExport = async () => {
  let includePaperLayout = true

  try {
    await ElMessageBox.confirm('本次导出是否包含试卷排版数据（附件、草稿、工具参数）？', '导出备份', {
      confirmButtonText: '包含',
      cancelButtonText: '不包含',
      type: 'info',
      distinguishCancelAndClose: true
    })
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
    setTimeout(() => {
      progressVisible.value = false
    }, 500)
    exporting.value = false
  }
}

const triggerImport = () => {
  fileInput.value?.click()
}

const handleDexieImport = async (file: File) => {
  try {
    await ElMessageBox.confirm('导入将覆盖当前所有数据，确定要继续吗？', '确认导入', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    importing.value = true
    progressTitle.value = '正在导入数据'
    progressPercent.value = 0
    progressVisible.value = true
    await importDatabase(file, updateProgress, () => {
      progressPercent.value = 100
      setTimeout(() => {
        progressVisible.value = false
        router.push('/overview')
      }, 500)
    })
    progressPercent.value = 100
  } catch {
    progressVisible.value = false
  } finally {
    importing.value = false
  }
}

const resetExcelImport = () => {
  columnSelectorVisible.value = false
  conflictDialogVisible.value = false
  excelHeaders.value = []
  excelRows.value = []
  pendingScoreColumns.value = []
  conflictColumns.value = []
}

const handleExcelScoreImport = async (file: File) => {
  importingExcel.value = true

  try {
    const { header, data } = await parseExcel({ raw: file } as UploadFile)

    if (!header.includes('姓名')) {
      ElMessage.error('已有数据导入 Excel 时，表格中必须包含[姓名]列')
      return
    }

    const duplicateExcelNames = findDuplicateNames(data, '姓名')
    if (duplicateExcelNames.length > 0) {
      ElMessage.error(`Excel 中存在重复姓名：${duplicateExcelNames.slice(0, 3).join('、')}`)
      return
    }

    const duplicateSystemNames = findDuplicateNames(items.value, NAME_PROP)
    if (duplicateSystemNames.length > 0) {
      ElMessage.error(`系统中存在重复姓名：${duplicateSystemNames.slice(0, 3).join('、')}`)
      return
    }

    excelHeaders.value = header
    excelRows.value = data
    columnSelectorVisible.value = true
  } catch {
    ElMessage.error('导入失败！')
  } finally {
    importingExcel.value = false
  }
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    if (file.name.endsWith('.dexie')) {
      await handleDexieImport(file)
      return
    }

    if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      await handleExcelScoreImport(file)
      return
    }

    ElMessage.error('请选择 .dexie、.xls 或 .xlsx 格式的文件')
  } finally {
    target.value = ''
  }
}

const applyExcelScoreImport = (conflictActions: Record<string, ConflictActionType>) => {
  const result = buildIncrementalScoreImport({
    rows: excelRows.value,
    existingStudents: items.value,
    existingHeaders: tableHeaders.value,
    selectedColumns: pendingScoreColumns.value,
    conflictActions
  })

  if (result.stats.addedColumnCount === 0 && result.stats.overwrittenColumnCount === 0) {
    ElMessage.warning('没有成绩列被导入')
    resetExcelImport()
    return
  }

  tableHeaders.value = result.headers
  items.value = result.students
  if (!configurationStore.inputScoreTab) {
    configurationStore.inputScoreTab = result.headers[0]?.prop
  }

  const messages = [
    `新增 ${result.stats.addedColumnCount} 列`,
    `覆盖 ${result.stats.overwrittenColumnCount} 列`,
    `跳过 ${result.stats.skippedColumnCount} 列`
  ]

  if (result.stats.ignoredStudentCount > 0) {
    messages.push(`忽略 ${result.stats.ignoredStudentCount} 名未匹配学生`)
  }
  if (result.stats.invalidScoreCount > 0) {
    messages.push(`${result.stats.invalidScoreCount} 个成绩无法识别，已置为空`)
  }

  ElMessage.success(`Excel 成绩导入完成：${messages.join('，')}`)
  resetExcelImport()
}

const handleExcelColumnConfirm = (value: { scoreColumns: string[] }) => {
  pendingScoreColumns.value = value.scoreColumns
  conflictColumns.value = getConflictLabels(value.scoreColumns, tableHeaders.value)
  columnSelectorVisible.value = false

  if (conflictColumns.value.length > 0) {
    conflictDialogVisible.value = true
    return
  }

  applyExcelScoreImport({})
}

const handleConflictConfirm = (actions: Record<string, ConflictActionType>) => {
  applyExcelScoreImport(actions)
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
    await clearDatabase(
      (percent) => {
        progressPercent.value = percent
      },
      () => {
        router.push('/empty')
      }
    )
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
        导出 .dexie 全量备份，支持在导出时选择是否包含试卷排版；导入时按文件后缀识别，.dexie
        恢复全量数据，Excel 导入成绩列
      </p>

      <div class="import-export-actions">
        <div class="action-item">
          <div class="action-icon action-icon-export">
            <font-awesome-icon :icon="['solid', 'file-export']" />
          </div>
          <div class="action-info">
            <div class="action-label">导出数据</div>
            <div class="action-desc">将学生、配置、标签、错题本等数据导出为 .dexie 备份，可选试卷排版</div>
          </div>
          <el-button type="primary" size="large" @click="handleExport" :loading="exporting">
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
            <div class="action-desc">选择 .dexie 覆盖恢复，或选择 Excel 按姓名新增/覆盖成绩列</div>
          </div>
          <el-button
            type="success"
            size="large"
            @click="triggerImport"
            :loading="importing || importingExcel"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'upload']" /></template>
            导入
          </el-button>
          <input
            ref="fileInput"
            type="file"
            accept=".dexie,.xls,.xlsx"
            style="display: none"
            @change="handleFileChange"
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
        <span>.dexie 导入会覆盖当前数据；Excel 导入只处理成绩列，不会清空现有数据</span>
      </div>
    </el-card>

    <ImportProgress
      v-model:visible="progressVisible"
      :title="progressTitle"
      :percent="progressPercent"
    />
    <ExcelColumnSelector
      v-model="columnSelectorVisible"
      mode="incremental"
      :headers="excelHeaders"
      :rows="excelRows"
      @confirm="handleExcelColumnConfirm"
    />
    <ExcelColumnConflictDialog
      v-model="conflictDialogVisible"
      :columns="conflictColumns"
      @confirm="handleConflictConfirm"
      @cancel="resetExcelImport"
    />
  </div>
</template>

<style scoped lang="scss">
.import-export__wrapper {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;

  .import-export-title {
    height: 32px;
    font-size: 18px;
    font-weight: 700;
    line-height: 32px;
    color: rgba(0, 0, 0, 0.85);
    margin-bottom: 8px;
  }

  .import-export-desc {
    font-size: 14px;
    color: #666;
    margin-bottom: 24px;
  }

  .import-export-actions {
    .action-item {
      display: flex;
      align-items: center;
      padding: 16px 0;

      .action-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        margin-right: 16px;

        svg {
          font-size: 24px;
        }

        &.action-icon-export {
          background: var(--el-color-primary-light-9);
          svg {
            color: var(--el-color-primary);
          }
        }

        &.action-icon-import {
          background: var(--el-color-success-light-9);
          svg {
            color: var(--el-color-success);
          }
        }

        &.action-icon-clear {
          background: var(--el-color-danger-light-9);
          svg {
            color: var(--el-color-danger);
          }
        }
      }

      .action-info {
        flex: 1;

        .action-label {
          font-size: 16px;
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }

        .action-desc {
          font-size: 13px;
          color: #999;
        }
      }
    }
  }

  .backup-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
    padding: 12px 16px;
    background: #f0f9ff;
    border-radius: 8px;
    font-size: 13px;
    color: #666;

    svg {
      color: var(--el-color-primary);
    }
  }
}
</style>
