<script setup lang="ts">
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { delay } from '@/utils/commonUntil'
import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

const emit = defineEmits<{
  edit: [row: StudentDataType]
}>()

const store = useDataSourceStore()
const settingStore = useSettingStore()
const configuration = useConfigurationStore()

const { enabledData: tableData } = storeToRefs(store)
const { tableHeaders } = storeToRefs(settingStore)

const tableRef = ref()
const showOnlyUnentered = ref(false)
const activeRow = ref<StudentDataType | null>(null)

const currentColumnLabel = computed(() => {
  const scoreTab = configuration.inputScoreTab
  if (!scoreTab) return '当前分数'
  return tableHeaders.value.find((item) => item.prop === scoreTab)?.label || scoreTab
})

const getCurrentScore = (row: StudentDataType): number | null => {
  if (!configuration.inputScoreTab) return null
  const score = row[configuration.inputScoreTab]
  if (typeof score === 'number' && Number.isFinite(score)) return score
  if (typeof score === 'string') {
    const parsed = parseFloat(score)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const displayData = computed(() => {
  if (!showOnlyUnentered.value) return tableData.value
  return tableData.value.filter((row) => getCurrentScore(row) === null)
})

const getScoreColor = (score: number) => {
  if (score >= 90) return '#22c55e'
  if (score >= 80) return '#3b82f6'
  if (score >= 70) return '#eab308'
  if (score >= 60) return '#f97316'
  if (score >= 50) return '#ef4444'
  if (score >= 40) return '#dc2626'
  if (score >= 30) return '#b91c1c'
  if (score >= 20) return '#991b1b'
  if (score >= 10) return '#7f1d1d'
  return '#450a0a'
}

const getRowStyle = ({ row }: { row: StudentDataType }) => {
  const score = getCurrentScore(row)
  if (score === null) return {}
  const color = getScoreColor(score)
  if (!color) return {}
  return {
    backgroundColor: color + '16'
  }
}

const sortByCurrentScore = (a: StudentDataType, b: StudentDataType) => {
  const scoreA = getCurrentScore(a)
  const scoreB = getCurrentScore(b)
  if (scoreA === null && scoreB === null) return 0
  if (scoreA === null) return -1
  if (scoreB === null) return 1
  return scoreA - scoreB
}

const rowClassName = ({ row }: { row: StudentDataType }) => {
  return row === activeRow.value ? 'score-table__active-row' : ''
}

const scroll = (index: number) => {
  const rowData = tableData.value[index - 1]
  if (!rowData) return
  activeRow.value = rowData

  const rowIndex = displayData.value.findIndex((item) => item === rowData)
  if (rowIndex === -1) return

  tableRef.value?.setCurrentRow(rowData)
  tableRef.value?.scrollTo(0, 50 * rowIndex)
  rowBlink(rowIndex + 1)
}

const rowBlink = async (index: number) => {
  const elems = tableRef.value?.$el.querySelectorAll('.el-table__row')
  if (!elems || !elems[index - 1]) return

  const ele = elems[index - 1]
  const classList = ele.classList

  const rowData = displayData.value[index - 1]
  const score = rowData ? getCurrentScore(rowData) : null
  const scoreColor = score === null ? null : getScoreColor(score)
  const originalColor = scoreColor ? scoreColor + '16' : ''

  if (classList.length > 1) {
    const backupClass = classList[1]

    for (let i = 0; i < 4; i++) {
      if (backupClass === classList[1]) {
        classList.remove(backupClass)
      } else {
        classList.add(backupClass)
      }
      await delay(260)
    }
  } else {
    for (let i = 0; i < 4; i++) {
      ele.style.backgroundColor = i % 2 === 0 ? '#e0f2fe' : originalColor
      await delay(260)
    }
  }
}

const handleEdit = (data: StudentDataType) => {
  activeRow.value = data
  emit('edit', data)
}

const clearActiveSelection = () => {
  activeRow.value = null
  tableRef.value?.setCurrentRow()
}

defineExpose({
  scroll,
  clearActiveSelection
})
</script>

<template>
  <div class="score-table-view">
    <div class="table-head-tools">
      <div class="title">学生列表</div>
      <el-switch
        v-model="showOnlyUnentered"
        inline-prompt
        active-text="仅未录入"
        inactive-text="全部"
      />
    </div>

    <el-table
      ref="tableRef"
      :data="displayData"
      size="large"
      height="calc(100% - 48px)"
      border
      highlight-current-row
      :row-style="getRowStyle"
      :row-class-name="rowClassName"
      @row-click="handleEdit"
    >
      <el-table-column type="index" label="序号" width="68" align="center" />
      <el-table-column :prop="NAME_PROP" label="姓名" min-width="120" />
      <el-table-column
        :prop="configuration.inputScoreTab || ''"
        :label="currentColumnLabel"
        min-width="120"
        sortable
        :sort-method="sortByCurrentScore"
      >
        <template #default="{ row }">
          <span>{{ getCurrentScore(row) ?? '--' }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped lang="scss">
.score-table-view {
  height: 100%;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--border-muted);
  padding: 10px;
  box-shadow: var(--shadow-card);

  .table-head-tools {
    height: 38px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

    .title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
}

:deep(.score-table__active-row td:first-child) {
  box-shadow: inset 3px 0 0 var(--theme-primary);
}

:deep(.el-table__row) {
  height: 50px;
  cursor: pointer;
}
</style>
