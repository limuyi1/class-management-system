<script setup lang="ts">
import { ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useSettingStore } from '@/stores/setting'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useAIConfigStore } from '@/stores/ai-config'
import { useThemeStore } from '@/stores/theme'

interface BackupData {
  version: number
  exportTime: string
  setting: {
    tableHeaders: any[]
    tagCategory: any[]
    tags: Record<string, string[]>
  }
  dataSource: {
    data: any[]
  }
  configuration: any
  aiConfig: {
    modelType: string
    model: string
    apiKey: string
    baseUrl: string
    prompts: any
    availableModels: string[]
  }
  theme: {
    currentTheme: string
  }
}

interface TagDiff {
  categoryName: string
  currentTags: string[]
  backupTags: string[]
  added: string[]
  removed: string[]
}

interface DiffResult {
  hasDiff: boolean
  setting: {
    tableHeaders: { current: number; backup: number; added: number; removed: number }
    tagCategory: { current: number; backup: number; added: number; removed: number }
    tags: { current: number; backup: number; added: number; removed: number }
    tagDetails: TagDiff[]
  }
  dataSource: {
    currentCount: number
    backupCount: number
    added: number
    removed: number
    modified: number
  }
  aiConfig: { hasDiff: boolean; diffFields: string[] }
}

const settingStore = useSettingStore()
const dataSourceStore = useDataSourceStore()
const configurationStore = useConfigurationStore()
const aiConfigStore = useAIConfigStore()
const themeStore = useThemeStore()

const { tableHeaders, tagCategory, tags } = storeToRefs(settingStore)
const { data } = storeToRefs(dataSourceStore)
const { data: configuration } = storeToRefs(configurationStore)
const { modelType, model, apiKey, baseUrl, prompts, availableModels } = storeToRefs(aiConfigStore)
const { currentTheme } = storeToRefs(themeStore)

const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const diffResult = ref<DiffResult | null>(null)
const showDiffDialog = ref(false)
const backupData = ref<BackupData | null>(null)

const exportBackup = () => {
  const backup: BackupData = {
    version: 1,
    exportTime: new Date().toISOString(),
    setting: {
      tableHeaders: JSON.parse(JSON.stringify(tableHeaders.value)),
      tagCategory: JSON.parse(JSON.stringify(tagCategory.value)),
      tags: JSON.parse(JSON.stringify(tags.value))
    },
    dataSource: {
      data: JSON.parse(JSON.stringify(data.value))
    },
    configuration: JSON.parse(JSON.stringify(configuration.value)),
    aiConfig: {
      modelType: modelType.value,
      model: model.value,
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
      prompts: JSON.parse(JSON.stringify(prompts.value)),
      availableModels: JSON.parse(JSON.stringify(availableModels.value))
    },
    theme: {
      currentTheme: currentTheme.value
    }
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `class-management-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  ElMessage.success('导出成功！')
}

const triggerImport = () => {
  fileInput.value?.click()
}

const compareData = (backup: BackupData): DiffResult => {
  const result: DiffResult = {
    hasDiff: false,
    setting: {
      tableHeaders: { current: 0, backup: 0, added: 0, removed: 0 },
      tagCategory: { current: 0, backup: 0, added: 0, removed: 0 },
      tags: { current: 0, backup: 0, added: 0, removed: 0 },
      tagDetails: []
    },
    dataSource: { currentCount: 0, backupCount: 0, added: 0, removed: 0, modified: 0 },
    aiConfig: { hasDiff: false, diffFields: [] }
  }

  const currentHeaders = tableHeaders.value
  const backupHeaders = backup.setting.tableHeaders

  result.setting.tableHeaders.current = currentHeaders.length
  result.setting.tableHeaders.backup = backupHeaders.length
  result.setting.tableHeaders.added = backupHeaders.filter(
    (bh) => !currentHeaders.some((ch) => ch.prop === bh.prop && ch.label === bh.label)
  ).length
  result.setting.tableHeaders.removed = currentHeaders.filter(
    (ch) => !backupHeaders.some((bh) => bh.prop === ch.prop && bh.label === ch.label)
  ).length

  const currentCategories = tagCategory.value
  const backupCategories = backup.setting.tagCategory

  result.setting.tagCategory.current = currentCategories.length
  result.setting.tagCategory.backup = backupCategories.length
  result.setting.tagCategory.added = backupCategories.filter(
    (bc) => !currentCategories.some((cc) => cc.prop === bc.prop && cc.label === bc.label)
  ).length
  result.setting.tagCategory.removed = currentCategories.filter(
    (cc) => !backupCategories.some((bc) => bc.prop === cc.prop && bc.label === cc.label)
  ).length

  const currentTags = tags.value
  const backupTags = backup.setting.tags

  result.setting.tags.current = Object.keys(currentTags).length
  result.setting.tags.backup = Object.keys(backupTags).length
  result.setting.tags.added = Object.keys(backupTags).filter((k) => !currentTags[k]).length
  result.setting.tags.removed = Object.keys(currentTags).filter((k) => !backupTags[k]).length

  const tagDetails: TagDiff[] = []
  const allCategoryKeys = new Set([...Object.keys(currentTags), ...Object.keys(backupTags)])
  for (const key of allCategoryKeys) {
    const currentList = (currentTags[key] || []).sort()
    const backupList = (backupTags[key] || []).sort()
    const added = backupList.filter((t) => !currentList.includes(t))
    const removed = currentList.filter((t) => !backupList.includes(t))
    if (added.length > 0 || removed.length > 0) {
      tagDetails.push({
        categoryName: key,
        currentTags: currentList,
        backupTags: backupList,
        added,
        removed
      })
    }
  }
  result.setting.tagDetails = tagDetails

  const currentData = data.value
  const backupDataList = backup.dataSource.data

  const currentDataMap = new Map<string, any>()
  for (const student of currentData) {
    currentDataMap.set(student.xing4_ming2, student)
  }

  let modifiedStudents = 0
  for (const backupStudent of backupDataList) {
    const name = backupStudent.xing4_ming2
    const currentStudent = currentDataMap.get(name)
    if (currentStudent) {
      const currentScores: any = {}
      const backupScores: any = {}
      for (const key of Object.keys(backupStudent)) {
        if (key !== 'xing4_ming2' && key !== 'comment' && key !== 'tags' && key !== 'disabled') {
          backupScores[key] = backupStudent[key]
        }
      }
      for (const key of Object.keys(currentStudent)) {
        if (key !== 'xing4_ming2' && key !== 'comment' && key !== 'tags' && key !== 'disabled') {
          currentScores[key] = currentStudent[key]
        }
      }
      if (JSON.stringify(currentScores) !== JSON.stringify(backupScores)) {
        modifiedStudents++
      }
    }
  }

  result.dataSource.currentCount = currentData.length
  result.dataSource.backupCount = backupDataList.length
  const currentNames = new Set(currentData.map((s) => s.xing4_ming2))
  const backupNames = new Set(backupDataList.map((s) => s.xing4_ming2))
  result.dataSource.added = backupDataList.filter((s) => !currentNames.has(s.xing4_ming2)).length
  result.dataSource.removed = currentData.filter((s) => !backupNames.has(s.xing4_ming2)).length
  result.dataSource.modified = modifiedStudents

  const diffFields: string[] = []
  if (modelType.value !== backup.aiConfig.modelType) diffFields.push('模型类型')
  if (model.value !== backup.aiConfig.model) diffFields.push('模型')
  if (baseUrl.value !== backup.aiConfig.baseUrl) diffFields.push('Base URL')
  if (JSON.stringify(prompts.value) !== JSON.stringify(backup.aiConfig.prompts))
    diffFields.push('提示词')
  result.aiConfig.hasDiff = diffFields.length > 0
  result.aiConfig.diffFields = diffFields

  result.hasDiff =
    result.setting.tableHeaders.added > 0 ||
    result.setting.tableHeaders.removed > 0 ||
    result.setting.tagCategory.added > 0 ||
    result.setting.tagCategory.removed > 0 ||
    result.setting.tags.added > 0 ||
    result.setting.tags.removed > 0 ||
    result.setting.tagDetails.length > 0 ||
    result.dataSource.added > 0 ||
    result.dataSource.removed > 0 ||
    result.dataSource.modified > 0 ||
    result.aiConfig.hasDiff

  return result
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  importing.value = true

  try {
    const text = await file.text()
    const backup = JSON.parse(text) as BackupData

    if (!backup.version || !backup.setting || !backup.dataSource) {
      ElMessage.error('无效的备份文件格式')
      return
    }

    backupData.value = backup
    diffResult.value = compareData(backup)

    if (diffResult.value.hasDiff) {
      showDiffDialog.value = true
    } else {
      await confirmImport('当前数据与备份一致，是否仍要导入？')
    }
  } catch {
    ElMessage.error('解析文件失败，请确保是有效的 JSON 文件')
  } finally {
    target.value = ''
    importing.value = false
  }
}

const confirmImport = async (message: string = '导入将覆盖当前所有数据，确定要继续吗？') => {
  try {
    await ElMessageBox.confirm(message, '确认导入', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    if (!backupData.value) return

    const backup = backupData.value

    tableHeaders.value = backup.setting.tableHeaders
    tagCategory.value = backup.setting.tagCategory
    tags.value = backup.setting.tags

    data.value = backup.dataSource.data

    configuration.value = backup.configuration

    aiConfigStore.modelType = backup.aiConfig.modelType as any
    aiConfigStore.model = backup.aiConfig.model
    aiConfigStore.apiKey = backup.aiConfig.apiKey
    aiConfigStore.baseUrl = backup.aiConfig.baseUrl
    aiConfigStore.prompts = backup.aiConfig.prompts
    aiConfigStore.availableModels = backup.aiConfig.availableModels

    themeStore.setTheme(backup.theme.currentTheme as any)

    ElMessage.success('导入成功！')
    showDiffDialog.value = false
    diffResult.value = null
    backupData.value = null
  } catch {
    // user cancel
  }
}

const cancelImport = () => {
  showDiffDialog.value = false
  diffResult.value = null
  backupData.value = null
}
</script>

<template>
  <div class="import-export__wrapper">
    <el-card>
      <div class="import-export-title">系统备份</div>
      <p class="import-export-desc">
        导出或导入系统配置数据，包括学生信息、表头配置、标签配置、AI 配置等
      </p>

      <div class="import-export-actions">
        <div class="action-item">
          <div class="action-icon">
            <font-awesome-icon :icon="['solid', 'file-export']" />
          </div>
          <div class="action-info">
            <div class="action-label">导出备份</div>
            <div class="action-desc">将当前所有数据导出为 JSON 文件</div>
          </div>
          <el-button type="primary" size="large" @click="exportBackup">
            <font-awesome-icon :icon="['solid', 'download']" />
            导出
          </el-button>
        </div>

        <el-divider />

        <div class="action-item">
          <div class="action-icon">
            <font-awesome-icon :icon="['solid', 'file-import']" />
          </div>
          <div class="action-info">
            <div class="action-label">导入备份</div>
            <div class="action-desc">从 JSON 备份文件恢复数据</div>
          </div>
          <el-button type="success" size="large" @click="triggerImport" :loading="importing">
            <font-awesome-icon :icon="['solid', 'upload']" />
            导入
          </el-button>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleFileChange"
          />
        </div>
      </div>

      <div class="backup-tip">
        <font-awesome-icon :icon="['solid', 'circle-info']" />
        <span>建议定期备份数据，以防数据丢失</span>
      </div>
    </el-card>

    <el-dialog v-model="showDiffDialog" title="数据对比" width="700px">
      <div class="diff-content" v-if="diffResult">
        <p class="diff-tip">检测到以下差异，导入将覆盖当前数据：</p>

        <div class="diff-table">
          <div class="diff-header">
            <div class="diff-col">项目</div>
            <div class="diff-col">当前数据</div>
            <div class="diff-col">备份数据</div>
          </div>

          <div class="diff-row">
            <div class="diff-col diff-col-title">学生数据</div>
            <div class="diff-col">
              <span>{{ diffResult.dataSource.currentCount }} 人</span>
              <span v-if="diffResult.dataSource.modified > 0" class="diff-badge diff-modified">
                {{ diffResult.dataSource.modified }} 人有修改
              </span>
            </div>
            <div class="diff-col">
              <span>{{ diffResult.dataSource.backupCount }} 人</span>
              <span v-if="diffResult.dataSource.added > 0" class="diff-badge diff-plus">
                +{{ diffResult.dataSource.added }}
              </span>
              <span v-if="diffResult.dataSource.removed > 0" class="diff-badge diff-minus">
                -{{ diffResult.dataSource.removed }}
              </span>
            </div>
          </div>

          <div class="diff-row">
            <div class="diff-col diff-col-title">表头配置</div>
            <div class="diff-col">
              <span>{{ diffResult.setting.tableHeaders.current }} 个</span>
            </div>
            <div class="diff-col">
              <span>{{ diffResult.setting.tableHeaders.backup }} 个</span>
              <span v-if="diffResult.setting.tableHeaders.added > 0" class="diff-badge diff-plus">
                +{{ diffResult.setting.tableHeaders.added }} 新增
              </span>
              <span
                v-if="diffResult.setting.tableHeaders.removed > 0"
                class="diff-badge diff-minus"
              >
                -{{ diffResult.setting.tableHeaders.removed }} 删除
              </span>
            </div>
          </div>

          <div class="diff-row">
            <div class="diff-col diff-col-title">标签分类</div>
            <div class="diff-col">
              <span>{{ diffResult.setting.tagCategory.current }} 个</span>
            </div>
            <div class="diff-col">
              <span>{{ diffResult.setting.tagCategory.backup }} 个</span>
              <span v-if="diffResult.setting.tagCategory.added > 0" class="diff-badge diff-plus">
                +{{ diffResult.setting.tagCategory.added }} 新增
              </span>
              <span v-if="diffResult.setting.tagCategory.removed > 0" class="diff-badge diff-minus">
                -{{ diffResult.setting.tagCategory.removed }} 删除
              </span>
            </div>
          </div>

          <div class="diff-row">
            <div class="diff-col diff-col-title">标签映射</div>
            <div class="diff-col">
              <span>{{ diffResult.setting.tags.current }} 个分类</span>
            </div>
            <div class="diff-col">
              <span>{{ diffResult.setting.tags.backup }} 个分类</span>
              <span v-if="diffResult.setting.tags.added > 0" class="diff-badge diff-plus">
                +{{ diffResult.setting.tags.added }}
              </span>
              <span v-if="diffResult.setting.tags.removed > 0" class="diff-badge diff-minus">
                -{{ diffResult.setting.tags.removed }}
              </span>
            </div>
          </div>

          <template v-if="diffResult.setting.tagDetails.length > 0">
            <div class="diff-row diff-row-sub">
              <div class="diff-col diff-col-title">标签详情</div>
              <div class="diff-col diff-col-full">
                <div
                  v-for="detail in diffResult.setting.tagDetails"
                  :key="detail.categoryName"
                  class="tag-detail-item"
                >
                  <span class="tag-category">{{ detail.categoryName }}:</span>
                  <span v-if="detail.added.length > 0" class="diff-plus"
                    >+{{ detail.added.join(', ') }}</span
                  >
                  <span v-if="detail.removed.length > 0" class="diff-minus"
                    >-{{ detail.removed.join(', ') }}</span
                  >
                  <span
                    v-if="detail.added.length === 0 && detail.removed.length === 0"
                    class="diff-unchanged"
                  >
                    {{ detail.currentTags.length }} → {{ detail.backupTags.length }}
                  </span>
                </div>
              </div>
            </div>
          </template>

          <div class="diff-row" v-if="diffResult.aiConfig.hasDiff">
            <div class="diff-col diff-col-title">AI 配置</div>
            <div class="diff-col">
              <span class="diff-unchanged">有变化</span>
            </div>
            <div class="diff-col">
              <span>{{ diffResult.aiConfig.diffFields.join('、') }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="cancelImport">取消</el-button>
        <el-button type="primary" @click="confirmImport('导入将覆盖当前所有数据，确定要继续吗？')">
          确认导入
        </el-button>
      </template>
    </el-dialog>
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
        background: var(--el-color-primary-light-9);
        border-radius: 12px;
        margin-right: 16px;

        svg {
          font-size: 24px;
          color: var(--el-color-primary);
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

.diff-content {
  .diff-tip {
    font-size: 14px;
    color: #e6a23c;
    margin-bottom: 16px;
    font-weight: 500;
  }

  .diff-table {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    overflow: hidden;

    .diff-header {
      display: flex;
      background: #f5f7fa;
      font-weight: 600;
      font-size: 13px;
      color: #303133;
      border-bottom: 1px solid #ebeef5;
    }

    .diff-row {
      display: flex;
      border-bottom: 1px solid #ebeef5;
      &:last-child {
        border-bottom: none;
      }
      &.diff-row-sub {
        background: #fafafa;
      }
    }

    .diff-col {
      flex: 1;
      padding: 12px;
      font-size: 13px;
      color: #606266;
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.diff-col-title {
        font-weight: 500;
        color: #303133;
        min-width: 100px;
      }

      &.diff-col-full {
        flex: 2;
      }
    }

    .diff-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;

      &.diff-plus {
        background: #f0f9eb;
        color: #67c23a;
      }

      &.diff-minus {
        background: #fef0f0;
        color: #f56c6c;
      }

      &.diff-modified {
        background: #fdf6ec;
        color: #e6a23c;
      }
    }

    .tag-detail-item {
      display: flex;
      gap: 8px;
      font-size: 12px;
      padding: 4px 0;
      flex-wrap: wrap;

      .tag-category {
        font-weight: 500;
        color: #303133;
      }

      .diff-plus {
        color: #67c23a;
      }

      .diff-minus {
        color: #f56c6c;
      }

      .diff-unchanged {
        color: #909399;
      }
    }

    .diff-unchanged {
      color: #909399;
    }

    .diff-plus {
      color: #67c23a;
    }

    .diff-minus {
      color: #f56c6c;
    }

    .diff-modified {
      color: #e6a23c;
    }
  }
}
</style>
