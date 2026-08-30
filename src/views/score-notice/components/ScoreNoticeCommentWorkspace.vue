<script setup lang="ts">
/**
 * 评语生成与检查工作区
 * 按状态筛选学生、批量/单条生成评语，并支持编辑、复制与保存。
 */
import { computed, ref, shallowRef, watch } from 'vue'

import { ElMessage } from 'element-plus'

import { useScoreNoticeStore } from '@/stores/score-notice'
import { ScoreNoticeCommentStatusEnum } from '@/types/ScoreNotice'
import { getScoreNoticeCommentValidationReasons } from '@/utils/score-notice/scoreNoticeCommentUtil'

import type { InputInstance } from 'element-plus'
import type { ScoreNoticeStudentType } from '@/types/ScoreNotice'

interface Props {
  expanded: boolean
  disabled: boolean
  aiConfigured: boolean
  batchGenerating: boolean
  batchProcessed: number
  batchTotal: number
  singleGenerating: boolean
}

type StudentFilterType = 'pending' | 'review' | 'completed' | 'missing' | 'all'
type BatchGenerateModeType = 'skip' | 'overwrite'

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  dirtyChange: [dirty: boolean]
  generateBatch: [mode: BatchGenerateModeType]
  stopBatch: []
  generateSingle: []
  copyImage: []
}>()

const store = useScoreNoticeStore()
const searchKeyword = shallowRef('')
const activeFilter = shallowRef<StudentFilterType>('pending')
const commentDraft = shallowRef('')
const savedComment = shallowRef('')
const commentInputRef = ref<InputInstance>()

const selectedStudent = computed(() => store.selectedStudent)
const hasUnsavedComment = computed(() => commentDraft.value !== savedComment.value)
const commentValidationReasons = computed(() =>
  getScoreNoticeCommentValidationReasons(commentDraft.value)
)
const progressPercentage = computed(() => {
  if (props.batchGenerating && props.batchTotal) {
    return Math.round((props.batchProcessed / props.batchTotal) * 100)
  }
  if (!store.students.length) return 0
  return Math.round(((store.generatedCount + store.reviewCount) / store.students.length) * 100)
})
/** 待生成评语的学生数量（不含缺少数据状态） */
const pendingGenerateCount = computed(
  () =>
    store.students.filter(
      (student) =>
        student.commentStatus !== ScoreNoticeCommentStatusEnum.Missing && !student.comment.trim()
    ).length
)

/** 评语状态对应的标签文案与样式类型 */
const statusConfig = {
  [ScoreNoticeCommentStatusEnum.Pending]: { label: '待生成', type: 'warning' },
  [ScoreNoticeCommentStatusEnum.Generating]: { label: '生成中', type: 'primary' },
  [ScoreNoticeCommentStatusEnum.Generated]: { label: '已生成', type: 'success' },
  [ScoreNoticeCommentStatusEnum.Manual]: { label: '已修改', type: 'success' },
  [ScoreNoticeCommentStatusEnum.NeedsReview]: { label: '需修改', type: 'danger' },
  [ScoreNoticeCommentStatusEnum.Failed]: { label: '生成失败', type: 'danger' },
  [ScoreNoticeCommentStatusEnum.Missing]: { label: '缺少数据', type: 'danger' }
} as const

/** 状态筛选按钮配置，计数来自 store 统计 */
const filters = computed<Array<{ key: StudentFilterType; label: string; count: number }>>(() => [
  { key: 'pending', label: '待处理', count: store.pendingCount },
  { key: 'review', label: '需修改', count: store.reviewCount },
  { key: 'completed', label: '已完成', count: store.generatedCount },
  { key: 'missing', label: '缺数据', count: store.missingCount },
  { key: 'all', label: '全部', count: store.students.length }
])

/** 判断学生是否命中当前状态筛选 */
const matchesFilter = (student: ScoreNoticeStudentType): boolean => {
  if (activeFilter.value === 'all') return true
  if (activeFilter.value === 'pending') {
    return [
      ScoreNoticeCommentStatusEnum.Pending,
      ScoreNoticeCommentStatusEnum.Generating,
      ScoreNoticeCommentStatusEnum.Failed
    ].includes(student.commentStatus)
  }
  if (activeFilter.value === 'review') {
    return student.commentStatus === ScoreNoticeCommentStatusEnum.NeedsReview
  }
  if (activeFilter.value === 'missing') {
    return student.commentStatus === ScoreNoticeCommentStatusEnum.Missing
  }
  return [ScoreNoticeCommentStatusEnum.Generated, ScoreNoticeCommentStatusEnum.Manual].includes(
    student.commentStatus
  )
}

/** 依据当前筛选与学生名过滤学生列表 */
const filteredStudents = computed(() => {
  const keyword = searchKeyword.value.trim()
  return store.students.filter(
    (student) => matchesFilter(student) && (!keyword || student.name.includes(keyword))
  )
})

/** 切换筛选并自动选中该状态下的第一名学生 */
const handleFilterChange = (filter: StudentFilterType): void => {
  flushDraft()
  activeFilter.value = filter
  const firstMatch = store.students.find(matchesFilter)
  if (firstMatch) store.selectStudent(firstMatch.id)
}

/** 批量生成按钮文案，随生成进度动态变化 */
const batchButtonLabel = computed(() => {
  if (props.batchGenerating) return `停止生成 ${props.batchProcessed}/${props.batchTotal}`
  if (!pendingGenerateCount.value) return '待生成评语已完成'
  return props.aiConfigured
    ? `生成待处理评语（${pendingGenerateCount.value}）`
    : `生成模板评语（${pendingGenerateCount.value}）`
})

/** 读取学生的校验原因（优先使用预计算值） */
const getValidationReason = (student: ScoreNoticeStudentType): string =>
  (student.validationReasons?.length
    ? student.validationReasons
    : getScoreNoticeCommentValidationReasons(student.comment)
  ).join('；')

/** 获取学生评语状态对应的展示配置 */
const getStatusConfig = (student: ScoreNoticeStudentType) => statusConfig[student.commentStatus]

/** 将当前草稿写入 store，用于切换学生前保留编辑 */
const flushDraft = (): void => {
  if (!selectedStudent.value || !hasUnsavedComment.value) return
  store.updateStudentComment(selectedStudent.value.id, commentDraft.value, true)
  savedComment.value = commentDraft.value
}

/** 保存草稿：有未保存修改时写回 store */
const saveDraft = (): void => {
  if (!hasUnsavedComment.value) return
  flushDraft()
  ElMessage.success('评语修改已保存')
}

/** 选中学生并同步草稿，切换前先保存上一学生的修改 */
const selectStudent = (studentId: string): void => {
  if (selectedStudent.value?.id === studentId) {
    commentInputRef.value?.focus()
    return
  }
  flushDraft()
  store.selectStudent(studentId)
}

/** 表格行点击选中学生 */
const handleRowClick = (student: ScoreNoticeStudentType): void => {
  selectStudent(student.id)
}

/** 复制当前评语文字到剪贴板 */
const copyComment = async (): Promise<void> => {
  if (!commentDraft.value.trim()) return
  try {
    await navigator.clipboard.writeText(commentDraft.value)
    ElMessage.success('评语文字已复制')
  } catch (error) {
    console.error('复制评语失败:', error)
    ElMessage.error('复制失败，请手动选择文字')
  }
}

/** 处理批量生成下拉命令并转发给父组件 */
const handleBatchCommand = (command: BatchGenerateModeType): void => {
  emit('generateBatch', command)
}

/** 供父组件填充评语草稿 */
const setCommentDraft = (comment: string): void => {
  commentDraft.value = comment
}

defineExpose({ setCommentDraft })

watch(
  () => selectedStudent.value?.id,
  // 切换学生时同步草稿与已保存内容
  () => {
    const nextComment = selectedStudent.value?.comment || ''
    commentDraft.value = nextComment
    savedComment.value = nextComment
  },
  { immediate: true, flush: 'sync' }
)

watch(
  () => selectedStudent.value?.comment,
  (nextComment) => {
    if ((nextComment || '') === commentDraft.value) return
    commentDraft.value = nextComment || ''
    savedComment.value = nextComment || ''
  },
  { flush: 'sync' }
)

watch(hasUnsavedComment, (dirty) => emit('dirtyChange', dirty), { immediate: true })
</script>

<template>
  <section class="notice-step notice-comments" :class="{ 'is-disabled': disabled }">
    <button
      class="notice-step__head"
      type="button"
      data-testid="notice-section-students"
      :aria-expanded="expanded"
      :disabled="disabled"
      @click="emit('toggle')"
    >
      <span class="notice-step__index">3</span>
      <span class="notice-step__heading">
        <strong>生成并检查评语</strong>
        <small v-if="disabled">完成通知设置后进入</small>
        <small v-else-if="store.pendingCount || store.reviewCount">
          {{ store.pendingCount }} 人待处理 · {{ store.reviewCount }} 人需修改
        </small>
        <small v-else>所有学生评语已处理</small>
      </span>
      <font-awesome-icon
        class="notice-step__chevron"
        :class="{ 'is-expanded': expanded }"
        :icon="['solid', 'chevron-down']"
      />
    </button>

    <div v-show="expanded && !disabled" class="notice-step__body">
      <!-- 按评语状态筛选学生 -->
      <div class="notice-comments__filters" aria-label="按评语状态筛选学生">
        <button
          v-for="filter in filters"
          :key="filter.key"
          type="button"
          :class="{ 'is-active': activeFilter === filter.key }"
          :aria-pressed="activeFilter === filter.key"
          @click="handleFilterChange(filter.key)"
        >
          {{ filter.label }} <span>{{ filter.count }}</span>
        </button>
      </div>

      <!-- 搜索学生与更多批量操作 -->
      <div class="notice-comments__toolbar">
        <el-input v-model="searchKeyword" clearable placeholder="搜索学生姓名">
          <template #prefix><font-awesome-icon :icon="['solid', 'magnifying-glass']" /></template>
        </el-input>
        <el-dropdown
          trigger="click"
          :disabled="batchGenerating || !store.students.length"
          @command="handleBatchCommand"
        >
          <el-button aria-label="更多批量生成操作">
            <font-awesome-icon :icon="['solid', 'ellipsis']" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="overwrite"> 重新生成全部评语 </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <el-button
        class="notice-comments__batch-button"
        :type="batchGenerating ? 'danger' : 'primary'"
        plain
        :disabled="!batchGenerating && (!pendingGenerateCount || !store.students.length)"
        @click="batchGenerating ? emit('stopBatch') : emit('generateBatch', 'skip')"
      >
        <font-awesome-icon :icon="['solid', batchGenerating ? 'stop' : 'wand-magic-sparkles']" />
        {{ batchButtonLabel }}
      </el-button>
      <el-progress
        v-if="store.students.length"
        class="notice-comments__progress"
        :percentage="progressPercentage"
        :show-text="false"
        :stroke-width="4"
        :status="progressPercentage === 100 ? 'success' : undefined"
      />

      <!-- 学生状态列表，点击行切换选中学生 -->
      <el-table
        class="notice-comments__student-table"
        :data="filteredStudents"
        max-height="190"
        highlight-current-row
        :current-row-key="store.selectedStudentId"
        row-key="id"
        empty-text="该状态下没有学生"
        @row-click="handleRowClick"
      >
        <el-table-column prop="name" label="学生" min-width="170">
          <template #default="{ row }">
            <button
              class="notice-comments__student-select"
              type="button"
              :aria-label="`选择${row.name}`"
              @click.stop="selectStudent(row.id)"
            >
              {{ row.name }}
            </button>
          </template>
        </el-table-column>
        <el-table-column label="评语状态" width="112" align="right">
          <template #default="{ row }">
            <el-tooltip
              :disabled="row.commentStatus !== ScoreNoticeCommentStatusEnum.NeedsReview"
              :content="getValidationReason(row)"
              placement="top"
            >
              <el-tag :type="getStatusConfig(row).type" size="small" effect="plain">
                {{ getStatusConfig(row).label }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <!-- 选中学生的评语编辑区 -->
      <div v-if="selectedStudent" class="notice-comments__editor">
        <div class="notice-comments__editor-head">
          <div>
            <strong>{{ selectedStudent.name }}的教师评语</strong>
            <small v-if="hasUnsavedComment" class="is-unsaved">有未保存修改</small>
            <small v-else>保存后同步到左侧预览</small>
          </div>
          <el-tag :type="getStatusConfig(selectedStudent).type" size="small" effect="plain">
            {{ getStatusConfig(selectedStudent).label }}
          </el-tag>
        </div>

        <el-input
          ref="commentInputRef"
          v-model="commentDraft"
          type="textarea"
          :rows="4"
          maxlength="300"
          show-word-limit
          resize="none"
          placeholder="输入本次考试表现、学习态度和后续建议"
        />

        <div v-if="commentValidationReasons.length" class="notice-comments__warning" role="alert">
          <font-awesome-icon :icon="['solid', 'triangle-exclamation']" />
          {{ commentValidationReasons.join('；') }}
        </div>

        <div class="notice-comments__secondary-actions">
          <el-button
            size="small"
            :loading="singleGenerating"
            :disabled="selectedStudent.commentStatus === ScoreNoticeCommentStatusEnum.Missing"
            @click="emit('generateSingle')"
          >
            <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
            {{ aiConfigured ? '重新生成' : '生成模板评语' }}
          </el-button>
          <el-button size="small" :disabled="!commentDraft.trim()" @click="copyComment">
            <font-awesome-icon :icon="['regular', 'copy']" />
            复制文字
          </el-button>
          <el-button size="small" :disabled="hasUnsavedComment" @click="emit('copyImage')">
            <font-awesome-icon :icon="['regular', 'image']" />
            复制图片
          </el-button>
        </div>

        <el-button
          class="notice-comments__save-button"
          type="primary"
          :disabled="!hasUnsavedComment"
          @click="saveDraft"
        >
          <font-awesome-icon :icon="['solid', 'check']" />
          {{ hasUnsavedComment ? '保存修改 · 未保存' : '修改已保存' }}
        </el-button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.notice-step {
  padding: 15px 18px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.notice-step.is-disabled {
  background: var(--el-fill-color-extra-light);
}
.notice-step__head {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 0;
  color: var(--el-text-color-primary);
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.notice-step__head:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.notice-step__head:focus-visible,
.notice-comments__filters button:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 3px;
}
.notice-step__index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  background: var(--el-color-primary);
  border-radius: 50%;
}
.notice-step__heading {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.notice-step__heading strong {
  font-size: 15px;
}
.notice-step__heading small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.notice-step__chevron {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  transition: transform 0.18s ease;
}
.notice-step__chevron.is-expanded {
  transform: rotate(180deg);
}
.notice-step__body {
  margin-top: 13px;
}
.notice-comments__filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 3px;
}
.notice-comments__filters button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  color: var(--el-text-color-regular);
  font-size: 11px;
  background: var(--el-fill-color-lighter);
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
}
.notice-comments__filters button span {
  min-width: 17px;
  padding: 1px 4px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-bg-color);
  border-radius: 8px;
}
.notice-comments__filters button.is-active {
  color: var(--el-color-primary);
  font-weight: 600;
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}
.notice-comments__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 7px;
  margin-top: 8px;
}
.notice-comments__toolbar .el-button {
  width: 34px;
  padding: 0;
}
.notice-comments__batch-button {
  width: 100%;
  margin-top: 8px;
}
.notice-comments__batch-button svg {
  margin-right: 7px;
}
.notice-comments__progress {
  margin: -3px 7px 5px;
}
.notice-comments__student-table {
  width: 100%;
  margin-top: 4px;
  --el-table-current-row-bg-color: var(--el-color-primary-light-9);
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
}
.notice-comments__student-table :deep(.el-table__row) {
  cursor: pointer;
}
.notice-comments__student-table :deep(.el-table__cell) {
  padding: 6px 0;
}
.notice-comments__student-select {
  width: 100%;
  padding: 3px 0;
  color: var(--el-text-color-primary);
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.notice-comments__student-select:focus-visible {
  color: var(--el-color-primary);
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 2px;
}
.notice-comments__editor {
  margin-top: 10px;
  padding: 11px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 7px;
}
.notice-comments__editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.notice-comments__editor-head > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.notice-comments__editor-head strong {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-comments__editor-head small {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}
.notice-comments__editor-head small.is-unsaved {
  color: var(--el-color-warning-dark-2);
}
.notice-comments__warning {
  margin-top: 7px;
  color: var(--el-color-danger);
  font-size: 11px;
  line-height: 1.5;
}
.notice-comments__warning svg {
  margin-right: 5px;
}
.notice-comments__secondary-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.notice-comments__secondary-actions .el-button {
  flex: 1;
  margin-left: 0;
  padding-right: 6px;
  padding-left: 6px;
}
.notice-comments__secondary-actions svg {
  margin-right: 4px;
}
.notice-comments__save-button {
  width: 100%;
  margin-top: 8px;
}
.notice-comments__save-button svg {
  margin-right: 6px;
}
</style>
