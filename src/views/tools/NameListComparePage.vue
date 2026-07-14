<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import ExcelColumnSelector from '@/components/ExcelColumnSelector.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useExcelPreviewImport } from '@/hooks/useExcelPreviewImport'
import NameListCompareResultCard from '@/views/tools/components/NameListCompareResultCard.vue'

import { buildExcelDataFromHeaderRow, exportExcel } from '@/utils/xlsxUntil'
import {
  buildNameEntries,
  buildNameListCompareResult,
  findSuggestedNameColumn,
  parsePastedRows
} from '@/views/tools/utils/nameListCompare'
import { useDataSourceStore } from '@/stores/data-source'
import { NAME_LABEL, NAME_PROP } from '@/types/Constants'
import type {
  NameListCompareGroupsType,
  NameListCompareImportedSourceType,
  NameListCompareModeType,
  NameListCompareRowType,
  NameListCompareSourceKeyType
} from '@/types/NameListCompare'

const router = useRouter()
const fileInputRef = ref<HTMLInputElement | null>(null)
const pasteDialogVisible = ref(false)
const pasteText = ref('')
const columnSelectorVisible = ref(false)
const pendingImportKey = ref<NameListCompareSourceKeyType>('comparison')
const mode = ref<NameListCompareModeType>('system')
const baselineKey = ref<'sourceA' | 'sourceB'>('sourceA')
const onlyDifference = ref(false)
const importedSources = ref<Partial<Record<NameListCompareSourceKeyType, NameListCompareImportedSourceType>>>({})
const columnSelectorHeaders = ref<string[]>([])
const columnSelectorRows = ref<NameListCompareRowType[]>([])
const suggestedNameColumn = ref('')

const dataSourceStore = useDataSourceStore()
const { enabledData } = storeToRefs(dataSourceStore)
// 文件读取、空表校验和错误提示走公共层；双来源槽位与姓名列确认仍由名单核对维护。
const { parseRawFile } = useExcelPreviewImport({ errorLogLabel: '导入名单 Excel' })

const systemRows = computed<NameListCompareRowType[]>(() => {
  return enabledData.value.map((student) => ({
    [NAME_LABEL]: student[NAME_PROP]
  }))
})

const systemSource = computed<NameListCompareImportedSourceType>(() => ({
  key: 'comparison',
  kind: 'system',
  label: '系统名单',
  headers: [NAME_LABEL],
  rows: systemRows.value,
  nameColumn: NAME_LABEL
}))

const activeSourceMap = computed(() => {
  if (mode.value === 'system') {
    return {
      baseline: systemSource.value,
      comparison: importedSources.value.comparison || null
    }
  }

  const activeBaseline = importedSources.value[baselineKey.value] || null
  const comparisonKey = baselineKey.value === 'sourceA' ? 'sourceB' : 'sourceA'
  return {
    baseline: activeBaseline,
    comparison: importedSources.value[comparisonKey] || null
  }
})

const baselineDisplayLabel = computed(() => {
  if (mode.value === 'system') return '基准名单（系统）'
  return `基准名单（${activeSourceMap.value.baseline?.label || '未选择'}）`
})

const comparisonDisplayLabel = computed(() => {
  if (mode.value === 'system') {
    return `对照名单（${activeSourceMap.value.comparison?.label || '未导入'}）`
  }
  return `对照名单（${activeSourceMap.value.comparison?.label || '未选择'}）`
})

const compareResult = computed(() => {
  const baselineSource = activeSourceMap.value.baseline
  const comparisonSource = activeSourceMap.value.comparison

  if (!baselineSource || !comparisonSource) return null
  if (!baselineSource.nameColumn || !comparisonSource.nameColumn) return null

  const baselineEntries = buildNameEntries(baselineSource.rows, baselineSource.nameColumn)
  const comparisonEntries = buildNameEntries(comparisonSource.rows, comparisonSource.nameColumn)

  return buildNameListCompareResult({
    baselineEntries,
    comparisonEntries
  })
})

function backToTools(): void {
  router.push('/tools')
}

function switchMode(value: NameListCompareModeType): void {
  mode.value = value
  onlyDifference.value = false
}

function openNameColumnDialog(key: NameListCompareSourceKeyType): void {
  pendingImportKey.value = key
  columnSelectorHeaders.value = importedSources.value[key]?.headers || []
  columnSelectorRows.value = importedSources.value[key]?.rows || []
  suggestedNameColumn.value = findSuggestedNameColumn(columnSelectorHeaders.value)
  columnSelectorVisible.value = true
}

function openUploadFor(key: NameListCompareSourceKeyType): void {
  pendingImportKey.value = key
  fileInputRef.value?.click()
}

function openPasteDialog(key: NameListCompareSourceKeyType): void {
  pendingImportKey.value = key
  pasteText.value = ''
  pasteDialogVisible.value = true
}

async function handleFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  const preview = await parseRawFile(file)
  if (!preview) return
  const { header, data } = buildExcelDataFromHeaderRow(
    preview.rows,
    preview.suggestedHeaderRowIndex
  )
  if (header.length === 0) {
    ElMessage.warning('未读取到可用表头')
    return
  }

  importedSources.value[pendingImportKey.value] = {
    key: pendingImportKey.value,
    kind: 'excel',
    label: file.name,
    headers: header,
    rows: data,
    nameColumn: ''
  }
  openNameColumnDialog(pendingImportKey.value)
}

function confirmPasteImport(): void {
  const text = pasteText.value.trim()
  if (!text) {
    ElMessage.warning('请先粘贴名单或表格内容')
    return
  }

  const { headers, rows } = parsePastedRows(text)
  if (headers.length === 0 || rows.length === 0) {
    ElMessage.warning('未识别到可用数据')
    return
  }

  importedSources.value[pendingImportKey.value] = {
    key: pendingImportKey.value,
    kind: 'paste',
    label: '粘贴内容',
    headers,
    rows,
    nameColumn: headers.length === 1 && headers[0] === NAME_LABEL ? NAME_LABEL : ''
  }
  pasteDialogVisible.value = false

  if (headers.length === 1 && headers[0] === NAME_LABEL) {
    ElMessage.success('名单已导入')
    return
  }

  openNameColumnDialog(pendingImportKey.value)
}

function clearSource(key: NameListCompareSourceKeyType): void {
  delete importedSources.value[key]
}

function clearCurrentImports(): void {
  if (mode.value === 'system') {
    clearSource('comparison')
    return
  }

  clearSource('sourceA')
  clearSource('sourceB')
}

function updateNameColumn(key: NameListCompareSourceKeyType, column: string): void {
  const source = importedSources.value[key]
  if (!source) return
  source.nameColumn = column
}

function handleNameColumnConfirm(payload: { nameColumn?: string }): void {
  const source = importedSources.value[pendingImportKey.value]
  if (!source || !payload.nameColumn) {
    columnSelectorVisible.value = false
    return
  }

  source.nameColumn = payload.nameColumn
  columnSelectorVisible.value = false
  ElMessage.success('名单已导入')
}

function buildExportHeader(group: keyof NameListCompareGroupsType): string {
  if (group === 'baselineOnly') return baselineDisplayLabel.value
  if (group === 'comparisonOnly') return comparisonDisplayLabel.value
  return '共同名单'
}

function getExportGroupNames(group: keyof NameListCompareGroupsType): string[] {
  if (!compareResult.value) return []
  return compareResult.value.groups[group]
}

async function handleResultAction(payload: {
  group: keyof NameListCompareGroupsType
  action: 'copy' | 'export'
}): Promise<void> {
  const names = getExportGroupNames(payload.group)
  if (names.length === 0) {
    ElMessage.warning('当前分组没有可处理的名单')
    return
  }

  if (payload.action === 'copy') {
    try {
      await navigator.clipboard.writeText(names.join('\n'))
      ElMessage.success('名单已复制')
    } catch (error) {
      console.error('复制名单失败:', error)
      ElMessage.error('复制失败，请检查浏览器权限')
    }
    return
  }

  const header = buildExportHeader(payload.group)
  const result = exportExcel(
    [header],
    names.map((name) => [name]),
    `${header}_${formatTimestamp()}.xlsx`
  )

  if (result.success) {
    ElMessage.success('导出成功')
  } else {
    ElMessage.error(result.error?.message || '导出失败')
  }
}

function formatTimestamp(): string {
  const now = new Date()
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((item) => String(item).padStart(2, '0'))
    .join('-')
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((item) => String(item).padStart(2, '0'))
    .join('-')
  return `${date}_${time}`
}
</script>

<template>
  <div class="name-list-compare-page app-page-shell">
    <page-header
      :icon="['solid', 'list-check']"
      title="名单核对"
      subtitle="生成对照视图，不修改原始表格"
    >
      <template #left>
        <el-tooltip content="返回工具" placement="top">
          <el-button size="small" circle aria-label="返回工具" @click="backToTools">
            <font-awesome-icon :icon="['solid', 'arrow-left']" />
          </el-button>
        </el-tooltip>
      </template>
    </page-header>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden-file-input"
      accept=".xls,.xlsx"
      @change="handleFileChange"
    />

    <div class="source-card">
      <div class="source-card__topbar">
        <el-radio-group :model-value="mode" size="default" @update:model-value="switchMode">
          <el-radio-button label="system">与系统名单核对</el-radio-button>
          <el-radio-button label="external">两个外部表格核对</el-radio-button>
        </el-radio-group>

        <div class="source-card__actions">
          <el-button
            v-if="mode === 'system' ? !!importedSources.comparison : !!importedSources.sourceA || !!importedSources.sourceB"
            @click="clearCurrentImports"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
            清空
          </el-button>
          <el-button @click="openUploadFor(mode === 'system' ? 'comparison' : baselineKey)">
            <template #icon><font-awesome-icon :icon="['solid', 'file-arrow-up']" /></template>
            上传 Excel
          </el-button>
          <el-button @click="openPasteDialog(mode === 'system' ? 'comparison' : baselineKey)">
            <template #icon><font-awesome-icon :icon="['solid', 'paste']" /></template>
            粘贴名单
          </el-button>
        </div>
      </div>

      <div v-if="mode === 'external'" class="baseline-choice">
        <span class="baseline-choice__label">基准表</span>
        <el-radio-group v-model="baselineKey" size="small">
          <el-radio-button label="sourceA">以 A 为基准</el-radio-button>
          <el-radio-button label="sourceB">以 B 为基准</el-radio-button>
        </el-radio-group>
      </div>

      <div class="source-overview">
        <div class="source-inline-info">
          <div class="source-inline-info__group">
            <span class="source-inline-info__label">基准来源：</span>
            <span class="source-inline-info__value">
              {{ mode === 'system' ? '系统名单' : importedSources[baselineKey]?.label || '未导入' }}
            </span>
            <span class="source-inline-info__meta is-count">
              {{
                mode === 'system'
                  ? `${systemRows.length} 行`
                  : `${importedSources[baselineKey]?.rows.length || 0} 行`
              }}
            </span>
            <el-select
              v-if="mode === 'external' && importedSources[baselineKey]"
              :model-value="importedSources[baselineKey]?.nameColumn"
              size="default"
              class="name-column-select"
              placeholder="姓名列"
              @update:model-value="(value: string) => updateNameColumn(baselineKey, value)"
            >
              <el-option
                v-for="header in importedSources[baselineKey]?.headers || []"
                :key="header"
                :label="`姓名列：${header}`"
                :value="header"
              />
            </el-select>
          </div>

          <div class="source-inline-info__group">
            <span class="source-inline-info__label">对照来源：</span>
            <span class="source-inline-info__value">
              {{
                mode === 'system'
                  ? importedSources.comparison?.label || '未导入'
                  : importedSources[baselineKey === 'sourceA' ? 'sourceB' : 'sourceA']?.label || '未导入'
              }}
            </span>
            <span class="source-inline-info__meta is-count">
              {{
                mode === 'system'
                  ? `${importedSources.comparison?.rows.length || 0} 行`
                  : `${importedSources[baselineKey === 'sourceA' ? 'sourceB' : 'sourceA']?.rows.length || 0} 行`
              }}
            </span>
            <el-select
              v-if="
                mode === 'system'
                  ? importedSources.comparison
                  : importedSources[baselineKey === 'sourceA' ? 'sourceB' : 'sourceA']
              "
              :model-value="
                mode === 'system'
                  ? importedSources.comparison?.nameColumn
                  : importedSources[baselineKey === 'sourceA' ? 'sourceB' : 'sourceA']?.nameColumn
              "
              size="default"
              class="name-column-select"
              placeholder="姓名列"
              @update:model-value="
                (value: string) =>
                  updateNameColumn(mode === 'system' ? 'comparison' : baselineKey === 'sourceA' ? 'sourceB' : 'sourceA', value)
              "
            >
              <el-option
                v-for="
                  header in mode === 'system'
                    ? importedSources.comparison?.headers || []
                    : importedSources[baselineKey === 'sourceA' ? 'sourceB' : 'sourceA']?.headers || []
                "
                :key="header"
                :label="`姓名列：${header}`"
                :value="header"
              />
            </el-select>
          </div>

          <div class="source-card__helper">
            <font-awesome-icon :icon="['solid', 'circle-info']" />
            <span>已自动去除姓名前后空格，已忽略空白行</span>
          </div>
        </div>
      </div>
    </div>

    <name-list-compare-result-card
      :baseline-label="baselineDisplayLabel"
      :comparison-label="comparisonDisplayLabel"
      :rows="compareResult?.rows || []"
      :summary="compareResult?.summary || null"
      :only-difference="onlyDifference"
      @update:only-difference="(value) => (onlyDifference = value)"
      @action="handleResultAction"
    />

    <el-dialog v-model="pasteDialogVisible" title="粘贴名单或表格" width="760px">
      <div class="paste-dialog">
        <div class="paste-dialog__hint">
          支持直接粘贴 Excel 表格内容，或粘贴单列姓名名单。多列表格默认使用首行作为表头。
        </div>
        <el-input
          v-model="pasteText"
          type="textarea"
          :rows="14"
          resize="none"
          placeholder="请在此粘贴名单或表格内容"
        />
      </div>

      <template #footer>
        <el-button @click="pasteDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPasteImport">确认导入</el-button>
      </template>
    </el-dialog>

    <ExcelColumnSelector
      v-model="columnSelectorVisible"
      mode="name-only"
      :headers="columnSelectorHeaders"
      :rows="columnSelectorRows"
      :default-name-column="suggestedNameColumn"
      @confirm="handleNameColumnConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
.name-list-compare-page {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hidden-file-input {
  display: none;
}

.source-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid var(--border-muted);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

.source-card__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.source-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.source-card :deep(.el-radio-button__inner) {
  color: var(--text-primary);
  background: #fff;
  border-color: #d7dee8;
  box-shadow: none;
}

.source-card :deep(.el-radio-button.is-active .el-radio-button__inner) {
  color: #fff;
  background: var(--theme-primary);
  border-color: var(--theme-primary);
  box-shadow: none;
}

.baseline-choice {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.baseline-choice__label {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.source-overview {
  padding: 8px 0 0;
}

.source-inline-info {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.source-inline-info__group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.source-inline-info__label {
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.source-inline-info__value {
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.source-inline-info__meta {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.source-inline-info__meta.is-count {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
}

.name-column-select {
  width: 180px;
}

.source-card__helper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
}

.source-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  color: var(--theme-primary);
  background: var(--theme-menu-active-bg);
  border: 1px solid color-mix(in srgb, var(--theme-primary) 20%, #ffffff);
  border-radius: 12px;
  font-size: 12px;
}

.paste-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.paste-dialog__hint {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 1280px) {
  .source-inline-info {
    gap: 12px;
  }

  .source-card__helper {
    margin-left: 0;
  }
}
</style>
