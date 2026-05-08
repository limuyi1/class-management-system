<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { ElTable } from 'element-plus'

import type {
  NameListCompareGroupsType,
  NameListCompareSummaryType,
  NameListCompareViewRowType
} from '@/types/NameListCompare'

type ExportGroupType = keyof NameListCompareGroupsType
type ExportActionType = 'copy' | 'export'

interface Props {
  baselineLabel: string
  comparisonLabel: string
  onlyDifference: boolean
  rows: NameListCompareViewRowType[]
  summary: NameListCompareSummaryType | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:onlyDifference': [value: boolean]
  action: [payload: { group: ExportGroupType; action: ExportActionType }]
}>()
const tableRef = ref<InstanceType<typeof ElTable>>()
const currentDifferenceCursor = ref(0)

const filteredRows = computed(() => {
  if (!props.onlyDifference) return props.rows
  return props.rows.filter((row) => !(row.baselineName && row.comparisonName))
})

const hasRows = computed(() => props.rows.length > 0)
const differenceRowIndexes = computed(() => {
  return filteredRows.value
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !(row.baselineName && row.comparisonName))
    .map(({ index }) => index)
})
const differenceCount = computed(() => differenceRowIndexes.value.length)
const hasDifferences = computed(() => differenceCount.value > 0)
const currentDifferenceRowIndex = computed(() => {
  if (!hasDifferences.value) return -1
  return differenceRowIndexes.value[currentDifferenceCursor.value] ?? -1
})

const summaryItems = computed(() => {
  if (!props.summary) return []

  return [
    {
      label: '匹配',
      value: `${props.summary.matchedCount}人`,
      icon: 'circle-check',
      tone: 'success'
    },
    {
      label: '仅基准',
      value: `${props.summary.baselineOnlyCount}人`,
      icon: 'user-minus',
      tone: 'warning'
    },
    {
      label: '仅对照',
      value: `${props.summary.comparisonOnlyCount}人`,
      icon: 'user-plus',
      tone: 'danger'
    }
  ]
})

function handleAction(group: ExportGroupType, action: ExportActionType): void {
  emit('action', { group, action })
}

function syncDifferenceCursor(): void {
  if (!hasDifferences.value) {
    currentDifferenceCursor.value = 0
    return
  }

  if (currentDifferenceCursor.value >= differenceCount.value) {
    currentDifferenceCursor.value = differenceCount.value - 1
  }
}

async function scrollToCurrentDifference(): Promise<void> {
  if (!hasDifferences.value || currentDifferenceRowIndex.value < 0) return

  await nextTick()
  const tableEl = tableRef.value?.$el as HTMLElement | undefined
  const rows = tableEl?.querySelectorAll('.el-table__body tbody .el-table__row')
  const targetRow = rows?.[currentDifferenceRowIndex.value] as HTMLElement | undefined
  if (!targetRow) return

  targetRow.scrollIntoView({
    block: 'center',
    behavior: 'smooth'
  })
}

function goToPreviousDifference(): void {
  if (!hasDifferences.value) return
  currentDifferenceCursor.value =
    currentDifferenceCursor.value === 0 ? differenceCount.value - 1 : currentDifferenceCursor.value - 1
  void scrollToCurrentDifference()
}

function goToNextDifference(): void {
  if (!hasDifferences.value) return
  currentDifferenceCursor.value =
    currentDifferenceCursor.value === differenceCount.value - 1 ? 0 : currentDifferenceCursor.value + 1
  void scrollToCurrentDifference()
}

function rowClassName({ row }: { row: NameListCompareViewRowType }): string {
  const rowIndex = filteredRows.value.indexOf(row)

  if (rowIndex === currentDifferenceRowIndex.value) {
    return 'compare-row is-current-difference'
  }

  if (!(row.baselineName && row.comparisonName)) {
    return 'compare-row is-difference'
  }

  return 'compare-row'
}

watch(
  () => [props.rows, props.onlyDifference],
  () => {
    syncDifferenceCursor()
    void scrollToCurrentDifference()
  },
  { deep: true, immediate: true }
)
</script>

<template>
  <div class="compare-result-card">
    <div v-if="summaryItems.length > 0" class="summary-strip">
      <button
        v-for="item in summaryItems"
        :key="item.label"
        type="button"
        class="summary-pill"
        :class="`is-${item.tone}`"
      >
        <span class="summary-pill__icon">
          <font-awesome-icon :icon="['solid', item.icon]" />
        </span>
        <span class="summary-pill__content">
          <span class="summary-pill__label">{{ item.label }}</span>
          <strong class="summary-pill__value">{{ item.value }}</strong>
        </span>
      </button>
    </div>

    <div class="result-card">
      <div class="result-card__header">
        <div class="result-card__title-group">
          <div class="result-card__title">对照视图</div>
          <div class="result-card__subtitle">按基准名单顺序生成，仅用于核对，不修改原始表格</div>
        </div>

        <div v-if="hasRows" class="result-card__actions">
          <div class="toolbar-chip">
            <el-switch
              :model-value="onlyDifference"
              inline-prompt
              active-text="差异"
              inactive-text="全部"
              @update:model-value="(value: boolean) => emit('update:onlyDifference', value)"
            />
          </div>

          <div class="difference-nav" :class="{ 'is-disabled': !hasDifferences }">
            <el-tooltip content="上一条差异" placement="top">
              <el-button
                size="small"
                text
                class="toolbar-icon-btn"
                :disabled="!hasDifferences"
                @click="goToPreviousDifference"
              >
                <font-awesome-icon :icon="['solid', 'chevron-up']" />
              </el-button>
            </el-tooltip>
            <span class="difference-nav__status">
              {{ hasDifferences ? `${currentDifferenceCursor + 1} / ${differenceCount}` : '0 / 0' }}
            </span>
            <el-tooltip content="下一条差异" placement="top">
              <el-button
                size="small"
                text
                class="toolbar-icon-btn"
                :disabled="!hasDifferences"
                @click="goToNextDifference"
              >
                <font-awesome-icon :icon="['solid', 'chevron-down']" />
              </el-button>
            </el-tooltip>
          </div>

          <el-dropdown trigger="click" placement="bottom-end">
            <el-button size="small" class="toolbar-dropdown-btn">
              <template #icon><font-awesome-icon :icon="['solid', 'download']" /></template>
              复制/导出
              <font-awesome-icon :icon="['solid', 'chevron-down']" />
            </el-button>

            <template #dropdown>
              <div class="export-panel">
                <div class="export-row">
                  <span class="export-row__label">A 差异</span>
                  <div class="export-row__actions">
                    <el-tooltip content="复制仅 A 有名单" placement="top">
                      <el-button size="small" circle @click="handleAction('baselineOnly', 'copy')">
                        <font-awesome-icon :icon="['solid', 'copy']" />
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="导出仅 A 有名单" placement="top">
                      <el-button size="small" circle class="export-icon-btn" @click="handleAction('baselineOnly', 'export')">
                        <font-awesome-icon :icon="['solid', 'file-export']" />
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>

                <div class="export-row">
                  <span class="export-row__label">B 差异</span>
                  <div class="export-row__actions">
                    <el-tooltip content="复制仅 B 有名单" placement="top">
                      <el-button size="small" circle class="export-icon-btn" @click="handleAction('comparisonOnly', 'copy')">
                        <font-awesome-icon :icon="['solid', 'copy']" />
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="导出仅 B 有名单" placement="top">
                      <el-button size="small" circle class="export-icon-btn" @click="handleAction('comparisonOnly', 'export')">
                        <font-awesome-icon :icon="['solid', 'file-export']" />
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>

                <div class="export-row">
                  <span class="export-row__label">共同</span>
                  <div class="export-row__actions">
                    <el-tooltip content="复制共同名单" placement="top">
                      <el-button size="small" circle class="export-icon-btn" @click="handleAction('matched', 'copy')">
                        <font-awesome-icon :icon="['solid', 'copy']" />
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="导出共同名单" placement="top">
                      <el-button size="small" circle class="export-icon-btn" @click="handleAction('matched', 'export')">
                        <font-awesome-icon :icon="['solid', 'file-export']" />
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </div>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div v-if="hasRows" class="result-table">
        <el-table
          ref="tableRef"
          :data="filteredRows"
          border
          height="100%"
          :row-class-name="rowClassName"
        >
          <el-table-column type="index" label="序号" width="72" align="center" />
          <el-table-column :label="baselineLabel" min-width="220">
            <template #default="{ row }">
              <div class="name-cell" :class="{ 'is-empty-baseline': !row.baselineName }">
                {{ row.baselineName }}
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="comparisonLabel" min-width="260">
            <template #default="{ row }">
              <div class="name-cell" :class="{ 'is-empty-comparison': !row.comparisonName }">
                {{ row.comparisonName }}
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-else description="请先导入名单并完成姓名列选择" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.compare-result-card {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.summary-pill {
  min-width: 148px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: var(--shadow-card);
  text-align: left;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.summary-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.summary-pill__icon {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 18px;
  flex-shrink: 0;
}

.summary-pill__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-pill__label {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.2;
}

.summary-pill__value {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.summary-pill.is-success {
  border-color: #ccebdc;
}

.summary-pill.is-success .summary-pill__icon {
  color: #16a34a;
  background: #effdf5;
}

.summary-pill.is-warning {
  border-color: #fde0b8;
}

.summary-pill.is-warning .summary-pill__icon {
  color: #ea580c;
  background: #fff7ed;
}

.summary-pill.is-danger {
  border-color: #fecdd3;
}

.summary-pill.is-danger .summary-pill__icon {
  color: #dc2626;
  background: #fef2f2;
}

.result-card {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border-muted);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

.result-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid #eef2f7;
}

.result-card__title-group {
  min-width: 0;
}

.result-card__title {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.result-card__subtitle {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.result-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-chip {
  height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.difference-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 6px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.difference-nav.is-disabled {
  opacity: 0.6;
}

.difference-nav__status {
  min-width: 44px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.toolbar-icon-btn {
  width: 24px;
  height: 24px;
  padding: 0;
}

.toolbar-dropdown-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
}

.toolbar-chip :deep(.el-switch) {
  height: 22px;
}

.toolbar-chip :deep(.el-switch__core) {
  min-width: 38px;
  height: 20px;
  border-radius: 999px;
}

.toolbar-chip :deep(.el-switch__label) {
  font-size: 12px;
}

.export-panel {
  min-width: 188px;
  padding: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
}

.export-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 6px;
}

.export-row + .export-row {
  border-top: 1px solid #eef2f7;
}

.export-row__label {
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.export-row__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.export-icon-btn {
  width: 28px;
  height: 28px;
}

.result-table {
  flex: 1;
  min-height: 0;
  padding: 0 12px 12px;
}

.name-cell {
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 8px;
  line-height: 20px;
}

.name-cell.is-empty-baseline {
  background: #fff7ed;
}

.name-cell.is-empty-comparison {
  background: #fef2f2;
}

:deep(.el-table) {
  height: 100%;
}

:deep(.el-table th.el-table__cell) {
  background: #f8fafc;
  color: var(--text-primary);
  font-weight: 600;
}

:deep(.el-table .el-table__cell) {
  padding: 6px 0;
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: var(--theme-primary);
  border-color: var(--theme-primary);
}

:deep(.el-table .compare-row.is-current-difference td) {
  background: #e0f2fe !important;
}

@media (max-width: 1280px) {
  .result-card__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .result-card__actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
