<script setup lang="ts">
import { computed, ref } from 'vue'
import { match } from 'pinyin-pro'
import { ElMessage } from 'element-plus'

import EmptyStatePanel from '@/components/EmptyStatePanel.vue'
import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import {
  buildStudentTrendChartOption,
  buildStudentTrendSummaries
} from '@/views/overview/services/dashboard/trend-chart'
import AppEChart from '@/components/AppEChart.vue'
import OverlengthTextTooltip from '@/components/OverlengthTextTooltip.vue'
import type {
  DashboardStudentOptionType,
  DashboardStudentTrendType,
  OverviewDashboardStageType
} from '@/types/HomeDashboard'

interface Props {
  /** 当前选中的学生姓名数组（v-model） */
  modelValue: string[]
  /** 趋势分析数据，支持单人和多人对比 */
  studentTrend: DashboardStudentTrendType | null
  /** 学生下拉选项列表 */
  studentOptions: DashboardStudentOptionType[]
  /** 快捷添加按钮的学生名单（来自关注列表） */
  quickStudentNames: string[]
  /** 展示变体：default 用于总览页，singleReadonly 用于外部单人查看入口 */
  variant?: 'default' | 'singleReadonly'
  /** 总览页当前数据阶段，用于解释趋势空态 */
  stage?: OverviewDashboardStageType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'go-evaluation': []
  'export-report': [name: string]
}>()

const chartMode = ref<'line' | 'bar'>('line')
const studentSearchKeyword = ref('')
const emptyCommentText = '暂无评语，可前往评语页继续处理'
const maxCompareCount = overviewDashboardConfig.studentTrend.maxCompareCount
const isSingleReadonly = computed(() => props.variant === 'singleReadonly')
const emptyTrendState = computed(() => {
  if (props.stage === 'noUnits') {
    return {
      title: '暂无成绩趋势',
      description:
        '当前已导入学生名单，但还没有设置单元。可以先维护评语和标签，或设置单元后录入成绩。'
    }
  }

  if (props.stage === 'noScores') {
    return {
      title: '暂无成绩趋势',
      description: '当前已有单元，但还没有可用于趋势分析的成绩。录入成绩后会生成学生趋势。'
    }
  }

  return {
    title: '请选择学生',
    description: '可通过多选搜索或点击右侧学生名单进行趋势对比。'
  }
})

const showMaxCompareWarning = () => {
  ElMessage.warning(`最多只能对比 ${maxCompareCount} 名学生`)
}

/**
 * 选中学生的计算属性，支持上限拦截。
 * 超过最大对比人数时自动拒绝并提示。
 */
const selectedValue = computed({
  get: () => props.modelValue,
  set: (value: string[]) => {
    if (isSingleReadonly.value) {
      emit('update:modelValue', value.slice(0, 1))
      return
    }

    if (value.length > maxCompareCount) {
      showMaxCompareWarning()
      return
    }

    emit('update:modelValue', value)
  }
})

const displaySummaries = computed(() => buildStudentTrendSummaries(props.studentTrend))
const chartOption = computed(() =>
  buildStudentTrendChartOption(props.studentTrend, chartMode.value)
)

/**
 * 快捷添加学生到对比列表。
 * 已选中学生会被移到列表首位，未选中学生会追加到末尾。
 */
const addQuickStudent = (name: string) => {
  if (!selectedValue.value.includes(name) && selectedValue.value.length >= maxCompareCount) {
    showMaxCompareWarning()
    return
  }

  const nextValue = [name, ...selectedValue.value.filter((item) => item !== name)]
  selectedValue.value = nextValue
}

const clearSelected = () => {
  selectedValue.value = []
}

const goToEvaluation = () => {
  emit('go-evaluation')
}

const exportReport = () => {
  const targetName =
    props.studentTrend?.mode === 'single' ? props.studentTrend.students[0]?.name : ''
  if (!targetName) return
  emit('export-report', targetName)
}

const filteredStudentOptions = computed(() => {
  const keyword = studentSearchKeyword.value.trim()
  if (!keyword) return props.studentOptions

  return props.studentOptions.filter((option) => {
    const studentName = option.label || option.value
    return studentName.includes(keyword) || !!match(studentName, keyword)?.length
  })
})

const handleStudentFilter = (query: string) => {
  studentSearchKeyword.value = query
}
</script>

<template>
  <div class="student-trend-panel">
    <div class="toolbar-row" :class="{ 'is-single-readonly': isSingleReadonly }">
      <el-select
        v-if="!isSingleReadonly"
        v-model="selectedValue"
        class="student-select"
        multiple
        filterable
        clearable
        :reserve-keyword="false"
        placeholder="输入姓名或拼音搜索并多选"
        :filter-method="handleStudentFilter"
      >
        <el-option
          v-for="option in filteredStudentOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>

      <div class="toolbar-actions">
        <el-segmented
          v-model="chartMode"
          class="chart-mode-segmented"
          :disabled="!studentTrend"
          :options="[
            { label: '折线图', value: 'line' },
            { label: '柱状图', value: 'bar' }
          ]"
        />
        <el-button class="evaluation-link-btn" type="primary" plain @click="goToEvaluation">
          <font-awesome-icon :icon="['solid', 'pen-to-square']" />
          <span>去评语页</span>
        </el-button>
      </div>
    </div>

    <div v-if="!isSingleReadonly && quickStudentNames.length" class="quick-students">
      <span class="quick-label">快捷加入</span>
      <button
        v-for="name in quickStudentNames"
        :key="name"
        class="quick-btn"
        @click="addQuickStudent(name)"
      >
        {{ name }}
      </button>
      <button v-if="selectedValue.length" class="quick-btn is-clear" @click="clearSelected">
        清空对比
      </button>
    </div>

    <template v-if="studentTrend">
      <div class="student-meta">
        <div class="meta-title">
          <span>{{
            studentTrend.mode === 'compare' ? '对比视图' : studentTrend.students[0]?.name
          }}</span>
          <div class="meta-actions">
            <el-tag v-if="!isSingleReadonly" type="info" round>
              {{
                studentTrend.mode === 'compare'
                  ? `共 ${studentTrend.students.length} 人`
                  : '单人模式'
              }}
            </el-tag>
            <el-button
              v-if="studentTrend.mode === 'single'"
              size="small"
              type="primary"
              plain
              @click="exportReport"
            >
              <font-awesome-icon :icon="['solid', 'file-arrow-down']" />
              <span>导出学习报告</span>
            </el-button>
          </div>
        </div>
        <div
          v-if="studentTrend.mode === 'single' && studentTrend.students[0]?.tags.length"
          class="meta-tags"
        >
          <el-tag
            v-for="tag in studentTrend.students[0].tags"
            :key="`${studentTrend.students[0]?.name}-${tag.key}`"
            size="small"
            round
            effect="plain"
          >
            {{ tag.label }}
          </el-tag>
        </div>
      </div>

      <div class="chart-wrapper">
        <app-e-chart :option="chartOption" height="100%" />
      </div>

      <div class="summary-panels">
        <div class="summary-section">
          <div class="summary-title">
            {{ studentTrend.mode === 'compare' ? '对比摘要' : '学情摘要' }}
          </div>
          <ul class="summary-list">
            <li v-for="summary in displaySummaries" :key="summary">{{ summary }}</li>
          </ul>
        </div>

        <div class="comment-section">
          <div class="summary-title">
            {{ studentTrend.mode === 'compare' ? '评语概览' : '评语预览' }}
          </div>
          <div v-if="studentTrend.mode === 'compare'" class="compare-comment-list">
            <div
              v-for="student in studentTrend.students"
              :key="student.name"
              class="compare-comment-item"
            >
              <div class="comment-name">{{ student.name }}</div>
              <div class="comment-body">
                <div v-if="student.tags.length" class="compare-tags">
                  <el-tag
                    v-for="tag in student.tags"
                    :key="`${student.name}-${tag.key}`"
                    size="small"
                    round
                  >
                    {{ tag.label }}
                  </el-tag>
                </div>
                <overlength-text-tooltip
                  :content="student.commentPreview || emptyCommentText"
                  :level="1"
                  custom-class="comment-status"
                  :custom-style="{
                    width: '100%',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6'
                  }"
                />
              </div>
            </div>
          </div>
          <overlength-text-tooltip
            v-else
            :content="studentTrend.students[0]?.commentPreview || emptyCommentText"
            :level="5"
            custom-class="comment-content"
            :custom-style="{
              flex: 1,
              width: '100%',
              color: 'var(--text-secondary)',
              lineHeight: '1.7'
            }"
          />
        </div>
      </div>
    </template>

    <empty-state-panel
      v-else
      icon="user-graduate"
      :title="emptyTrendState.title"
      :description="emptyTrendState.description"
      min-height="240px"
      description-max-width="460px"
    />
  </div>
</template>

<style scoped lang="scss">
.student-trend-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar-row {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 1px solid #e5edf5;
  border-radius: 12px;
  background: #ffffff;
}

.toolbar-row.is-single-readonly {
  grid-template-columns: 1fr;

  .toolbar-actions {
    justify-content: flex-end;
  }
}

.student-select {
  width: 100%;
}

.toolbar-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.chart-mode-segmented {
  flex-shrink: 0;
}

.evaluation-link-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.quick-students {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.quick-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.quick-btn {
  padding: 5px 10px;
  border: 1px solid var(--border-muted);
  border-radius: 999px;
  background: #fff;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.is-clear {
  color: #dc2626;
}

.student-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.meta-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chart-wrapper {
  height: clamp(260px, 38vh, 340px);
  min-height: 260px;
  flex: 0 0 clamp(260px, 38vh, 340px);
}

.summary-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-section,
.comment-section {
  min-height: 0;
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
}

.comment-section {
  display: flex;
  flex-direction: column;
}

.summary-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

:deep(.comment-content) {
  flex: 1;
  font-size: 12px;
}

.compare-comment-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.compare-comment-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  font-size: 12px;
}

.comment-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.comment-name {
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
}

:deep(.comment-status) {
  min-width: 0;
  font-size: 12px;
}

@media (max-width: 960px) {
  .toolbar-row {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }

  .evaluation-link-btn {
    min-width: 104px;
  }

  .chart-wrapper {
    height: 280px;
    min-height: 280px;
    flex-basis: 280px;
  }

  .summary-panels {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .toolbar-row {
    padding: 8px;
  }

  .toolbar-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .chart-mode-segmented,
  .evaluation-link-btn {
    width: 100%;
  }

  .evaluation-link-btn {
    justify-content: center;
  }

  .quick-students {
    gap: 6px;
  }

  .quick-btn {
    padding: 5px 8px;
  }

  .meta-title {
    flex-wrap: wrap;
  }

  .chart-wrapper {
    height: 240px;
    min-height: 240px;
    flex-basis: 240px;
  }
}
</style>
