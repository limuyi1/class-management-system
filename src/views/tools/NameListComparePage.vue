<script setup lang="ts">
import { useRouter } from 'vue-router'

import ExcelColumnSelector from '@/components/ExcelColumnSelector.vue'
import PageHeader from '@/components/PageHeader.vue'
import NameListCompareResultCard from '@/views/tools/components/NameListCompareResultCard.vue'
import { useNameListComparison } from '@/views/tools/composables/useNameListComparison'

const {
  fileInputRef,
  pasteDialogVisible,
  pasteText,
  columnSelectorVisible,
  mode,
  baselineKey,
  onlyDifference,
  importedSources,
  columnSelectorHeaders,
  columnSelectorRows,
  suggestedNameColumn,
  systemRows,
  baselineDisplayLabel,
  comparisonDisplayLabel,
  compareResult,
  switchMode,
  openUploadFor,
  openPasteDialog,
  handleFileChange,
  confirmPasteImport,
  clearCurrentImports,
  updateNameColumn,
  handleNameColumnConfirm,
  handleResultAction
} = useNameListComparison()

const router = useRouter()

function backToTools(): void {
  router.push('/tools')
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
      <!-- 模式切换与导入/清空操作 -->
      <div class="source-card__topbar">
        <el-radio-group :model-value="mode" size="default" @update:model-value="switchMode">
          <el-radio-button value="system">与系统名单核对</el-radio-button>
          <el-radio-button value="external">两个外部表格核对</el-radio-button>
        </el-radio-group>

        <div class="source-card__actions">
          <!-- 当前模式下任一来源已有数据时显示清空按钮 -->
          <el-button
            v-if="
              mode === 'system'
                ? !!importedSources.comparison
                : !!importedSources.sourceA || !!importedSources.sourceB
            "
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

      <!-- 外部核对模式下的基准表选择 -->
      <div v-if="mode === 'external'" class="baseline-choice">
        <span class="baseline-choice__label">基准表</span>
        <el-radio-group v-model="baselineKey" size="small">
          <el-radio-button value="sourceA">以 A 为基准</el-radio-button>
          <el-radio-button value="sourceB">以 B 为基准</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 来源概览：基准与对照的标签、行数与姓名列选择 -->
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
                  : importedSources[baselineKey === 'sourceA' ? 'sourceB' : 'sourceA']?.label ||
                    '未导入'
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
                  updateNameColumn(
                    mode === 'system'
                      ? 'comparison'
                      : baselineKey === 'sourceA'
                        ? 'sourceB'
                        : 'sourceA',
                    value
                  )
              "
            >
              <el-option
                v-for="header in mode === 'system'
                  ? importedSources.comparison?.headers || []
                  : importedSources[baselineKey === 'sourceA' ? 'sourceB' : 'sourceA']?.headers ||
                    []"
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

    <!-- 对比结果卡片：汇总胶囊、差异导航与对照表格 -->
    <name-list-compare-result-card
      :baseline-label="baselineDisplayLabel"
      :comparison-label="comparisonDisplayLabel"
      :rows="compareResult?.rows || []"
      :summary="compareResult?.summary || null"
      :only-difference="onlyDifference"
      @update:only-difference="(value) => (onlyDifference = value)"
      @action="handleResultAction"
    />

    <!-- 粘贴导入弹窗 -->
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

    <!-- 姓名列确认弹窗 -->
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
