<script setup lang="ts">
import { ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { exportDatabase, importDatabase, clearDatabase } from '@/utils/backup'

const fileInput = ref<HTMLInputElement | null>(null)
const exporting = ref(false)
const importing = ref(false)

const handleExport = async () => {
  try {
    await ElMessageBox.confirm('确定要导出所有数据吗？', '确认导出', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    exporting.value = true
    await exportDatabase()
  } catch {
    // user cancel
  } finally {
    exporting.value = false
  }
}

const triggerImport = () => {
  fileInput.value?.click()
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.name.endsWith('.db')) {
    ElMessage.error('请选择 .db 格式的备份文件')
    target.value = ''
    return
  }

  try {
    await ElMessageBox.confirm('导入将覆盖当前所有数据，确定要继续吗？', '确认导入', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    importing.value = true
    await importDatabase(file)
  } catch {
    // user cancel
  } finally {
    target.value = ''
    importing.value = false
  }
}

const handleClear = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有数据吗？此操作不可恢复！', '确认清空', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    })
    await clearDatabase()
  } catch {
    // user cancel
  }
}
</script>

<template>
  <div class="import-export__wrapper">
    <el-card>
      <div class="import-export-title">系统备份</div>
      <p class="import-export-desc">
        导出或导入系统数据，包括学生信息、表头配置、标签配置、AI 配置、错题本等所有数据
      </p>

      <div class="import-export-actions">
        <div class="action-item">
          <div class="action-icon action-icon-export">
            <font-awesome-icon :icon="['solid', 'file-export']" />
          </div>
          <div class="action-info">
            <div class="action-label">导出数据</div>
            <div class="action-desc">将所有数据导出为 .db 文件（推荐）</div>
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
            <div class="action-desc">从 .db 备份文件恢复所有数据</div>
          </div>
          <el-button type="success" size="large" @click="triggerImport" :loading="importing">
            <template #icon><font-awesome-icon :icon="['solid', 'upload']" /></template>
            导入
          </el-button>
          <input
            ref="fileInput"
            type="file"
            accept=".db"
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
        <span>建议定期备份数据，以防数据丢失</span>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.import-export__wrapper {
  width: 600px;
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
