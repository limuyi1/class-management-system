<script setup lang="ts">
/**
 * 成绩表格视图
 * 展示学生列表，支持切换当前录入科目、仅查看未录入学生、定位到指定行并闪烁提示。
 */
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { getScoreColor } from '@/config/score'
import { delay } from '@/utils/commonUtil'
import { NAME_PROP } from '@/constants'
import type { ScorePageStageType } from '@/types/Score'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  scoreColumns: SettingType[]
  scoreTab?: string | null
  stage: ScorePageStageType
}

const emit = defineEmits<{
  'update:scoreTab': [value: string]
  resetScore: []
  edit: [row: StudentDataType]
  inspectStudent: [row: StudentDataType]
}>()

const store = useDataSourceStore()
const configuration = useConfigurationStore()

const { enabledData: tableData } = storeToRefs(store)
const props = defineProps<Props>()

const tableRef = ref()
const showOnlyUnentered = ref(false)
const activeStudentId = ref<string | null>(null)

/** 当前分数列的展示名称，无科目时回退为“当前分数” */
const currentColumnLabel = computed(() => {
  const scoreTab = configuration.inputScoreTab
  if (!scoreTab) return '当前分数'
  return props.scoreColumns.find((item) => item.prop === scoreTab)?.label || scoreTab
})

/**
 * 读取指定学生在当前录入科目下的分数。
 * @param row 学生行数据
 * @returns 有效分数，未录入或非法时返回 null
 */
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

/** 按“仅未录入”开关过滤后的表格数据 */
const displayData = computed(() => {
  if (!showOnlyUnentered.value) return tableData.value
  return tableData.value.filter((row) => getCurrentScore(row) === null)
})

/** 依据分数档位为行设置淡色背景，未录入或无色时不设置 */
const getRowStyle = ({ row }: { row: StudentDataType }) => {
  const score = getCurrentScore(row)
  if (score === null) return {}
  const color = getScoreColor(score)
  if (!color) return {}
  return {
    backgroundColor: color + '16'
  }
}

/**
 * 按当前科目分数排序，未录入的行始终排在最前。
 * @param a 待比较学生
 * @param b 待比较学生
 * @returns 排序差值
 */
const sortByCurrentScore = (a: StudentDataType, b: StudentDataType) => {
  const scoreA = getCurrentScore(a)
  const scoreB = getCurrentScore(b)
  if (scoreA === null && scoreB === null) return 0
  if (scoreA === null) return -1
  if (scoreB === null) return 1
  return scoreA - scoreB
}

/** 为当前定位学生所在行添加高亮类名 */
const rowClassName = ({ row }: { row: StudentDataType }) => {
  return row.studentId === activeStudentId.value ? 'score-table__active-row' : ''
}

/**
 * 将指定学生滚动到可视区域并触发闪烁定位。
 * @param studentId 学生 ID
 */
const scroll = (studentId: string) => {
  const rowData = tableData.value.find((student) => student.studentId === studentId)
  if (!rowData) return
  activeStudentId.value = studentId

  const rowIndex = displayData.value.findIndex((item) => item.studentId === studentId)
  if (rowIndex === -1) return

  tableRef.value?.setCurrentRow(rowData)
  const rowHeight = tableRef.value?.$el?.querySelector('.el-table__row')?.offsetHeight || 50
  tableRef.value?.scrollTo(0, rowHeight * rowIndex)
  rowBlink(rowIndex + 1)
}

/**
 * 让目标行闪烁数秒用于定位提示。
 * 行已有背景类时在类名增删间切换，否则直接切换行内背景色。
 * @param index 从 1 起始的行序号
 */
const rowBlink = async (index: number) => {
  const elems = tableRef.value?.$el.querySelectorAll('.el-table__row')
  if (!elems || !elems[index - 1]) return

  const ele = elems[index - 1]
  const classList = ele.classList

  const rowData = displayData.value[index - 1]
  const score = rowData ? getCurrentScore(rowData) : null
  const scoreColor = score === null ? null : getScoreColor(score)
  const originalColor = scoreColor ? scoreColor + '16' : ''

  // 有背景类时通过类名增删闪烁，无背景类时直接切换行内背景色
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

/** 行点击进入编辑，同时记录当前学生用于高亮 */
const handleEdit = (data: StudentDataType) => {
  activeStudentId.value = data.studentId
  emit('edit', data)
}

/** 触发查看学生趋势分析 */
const handleInspectStudent = (row: StudentDataType) => {
  emit('inspectStudent', row)
}

/** 清除当前选中行与高亮 */
const clearActiveSelection = () => {
  activeStudentId.value = null
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
      <div class="table-head-main">
        <div class="title">学生列表</div>
        <el-switch
          v-model="showOnlyUnentered"
          inline-prompt
          active-text="仅未录入"
          inactive-text="全部"
        />
      </div>
      <div v-if="stage !== 'noUnits'" class="table-head-sub">
        <div class="score-context">
          <span class="score-context__label">当前科目</span>
          <el-select
            :model-value="scoreTab"
            class="score-context__select"
            placeholder="选择录入科目"
            @update:model-value="(value: string) => emit('update:scoreTab', value)"
          >
            <el-option
              v-for="item in scoreColumns"
              :key="item.prop"
              :label="item.label"
              :value="item.prop"
            />
          </el-select>
        </div>
        <el-button class="reset-btn" text @click="emit('resetScore')"> 重置当前科目 </el-button>
      </div>
    </div>

    <el-table
      ref="tableRef"
      :data="displayData"
      row-key="studentId"
      size="large"
      height="100%"
      border
      highlight-current-row
      :row-style="getRowStyle"
      :row-class-name="rowClassName"
      @row-click="handleEdit"
    >
      <el-table-column type="index" label="序号" width="68" align="center" />
      <el-table-column :prop="NAME_PROP" label="姓名" min-width="120">
        <template #default="{ row }">
          <button class="student-link" type="button" @click.stop="handleInspectStudent(row)">
            {{ row[NAME_PROP] }}
          </button>
        </template>
      </el-table-column>
      <el-table-column
        v-if="stage !== 'noUnits'"
        :prop="configuration.inputScoreTab || ''"
        :label="currentColumnLabel"
        min-width="120"
        sortable
        :sort-method="sortByCurrentScore"
      >
        <template #default="{ row }">
          <span v-if="getCurrentScore(row) !== null">{{ getCurrentScore(row) }}</span>
          <span v-else class="score-empty-text">未录入</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped lang="scss">
.score-table-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--border-muted);
  padding: 10px;
  box-shadow: var(--shadow-card);

  .table-head-tools {
    display: flex;
    flex-direction: column;
    margin-bottom: 10px;
    gap: 10px;
  }

  .table-head-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .table-head-sub {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border: 1px solid var(--border-muted);
    border-radius: 10px;
    background: #f8fafc;
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .score-context {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .score-context__label {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .score-context__select {
    width: 160px;
  }

  .reset-btn {
    flex-shrink: 0;
    padding: 0;
    color: var(--text-secondary);

    &:hover,
    &:focus {
      color: #b91c1c;
    }
  }

  :deep(.el-table) {
    flex: 1;
    min-height: 0;
  }
}

:deep(.score-table__active-row td:first-child) {
  box-shadow: inset 3px 0 0 var(--theme-primary);
}

:deep(.el-table__row) {
  height: 50px;
  cursor: pointer;
}

.student-link {
  padding: 0;
  color: var(--theme-primary);
  background: transparent;
  border: 0;
  font: inherit;
  cursor: pointer;
}

.student-link:hover {
  text-decoration: underline;
}

.score-empty-text {
  color: #94a3b8;
}
</style>
