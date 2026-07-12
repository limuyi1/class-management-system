<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import type { InputInstance } from 'element-plus'

import { useScoreNoticeStore } from '@/stores/score-notice'
import { ScoreNoticeCommentStatusEnum, ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import { getScoreNoticeCommentValidationReasons } from '@/utils/scoreNoticeCommentUntil'

import type { ScoreNoticeStudentType } from '@/types/ScoreNotice'

interface Props {
  batchGenerating: boolean
  batchProcessed: number
  batchTotal: number
  singleGenerating: boolean
  handwriteFontName: string
  hasCustomHandwriteFont: boolean
  handwriteFontApplying: boolean
  exporting: boolean
  exportProcessed: number
}

type SectionKeyType = 'settings' | 'students'

const props = defineProps<Props>()
const emit = defineEmits<{
  openImport: []
  generateBatch: []
  stopBatch: []
  generateSingle: []
  chooseHandwriteFont: []
  clearHandwriteFont: []
  copyImage: []
  copyStudent: [studentId: string]
  exportZip: []
}>()

const store = useScoreNoticeStore()
const searchKeyword = ref('')
const commentDraft = ref('')
const commentInputRef = ref<InputInstance>()
const savedComment = ref('')
const expandedSections = ref<Record<SectionKeyType, boolean>>({
  settings: true,
  students: true
})

const selectedStudent = computed(() => store.selectedStudent)
const filteredStudents = computed(() => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return store.students
  return store.students.filter((student) => student.name.includes(keyword))
})
const progressPercentage = computed(() => {
  if (!props.batchGenerating || !props.batchTotal) {
    return store.students.length
      ? Math.round((store.generatedCount / store.students.length) * 100)
      : 0
  }
  return Math.round((props.batchProcessed / props.batchTotal) * 100)
})
const canUseScoreMode = computed(() => store.sourceMode === ScoreNoticeModeEnum.Score)
const commentValidationReasons = computed(() =>
  getScoreNoticeCommentValidationReasons(commentDraft.value)
)
const hasUnsavedComment = computed(() => commentDraft.value !== savedComment.value)

const statusConfig = {
  [ScoreNoticeCommentStatusEnum.Pending]: { label: '待生成', type: 'warning' },
  [ScoreNoticeCommentStatusEnum.Generating]: { label: '生成中', type: 'primary' },
  [ScoreNoticeCommentStatusEnum.Generated]: { label: '已生成', type: 'success' },
  [ScoreNoticeCommentStatusEnum.Manual]: { label: '已修改', type: 'success' },
  [ScoreNoticeCommentStatusEnum.NeedsReview]: { label: '需修改', type: 'danger' },
  [ScoreNoticeCommentStatusEnum.Failed]: { label: '生成失败', type: 'danger' },
  [ScoreNoticeCommentStatusEnum.Missing]: { label: '缺少数据', type: 'danger' }
} as const

const getValidationReason = (student: ScoreNoticeStudentType): string =>
  (student.validationReasons?.length
    ? student.validationReasons
    : getScoreNoticeCommentValidationReasons(student.comment)
  ).join('；')

const getStatusConfig = (student: ScoreNoticeStudentType) => statusConfig[student.commentStatus]

const handleRowClick = async (student: ScoreNoticeStudentType): Promise<void> => {
  await selectStudent(student.id)
}

const flushDraft = (): void => {
  if (!selectedStudent.value) return
  store.updateStudentComment(selectedStudent.value.id, commentDraft.value, true)
}

const saveDraft = (): void => {
  flushDraft()
  savedComment.value = commentDraft.value
  ElMessage.success('评语修改已保存')
}

const setCommentDraft = (comment: string): void => {
  commentDraft.value = comment
}

defineExpose({ setCommentDraft })

const toggleSection = (section: SectionKeyType): void => {
  expandedSections.value[section] = !expandedSections.value[section]
}

const getStudentActionIcon = (
  studentId: string,
  hasComment: boolean
): ['solid' | 'regular', string] => {
  if (studentId === store.selectedStudentId) return ['solid', 'pen']
  if (hasComment) return ['regular', 'copy']
  return ['solid', 'minus']
}

const handleStudentAction = (studentId: string, hasComment: boolean): void => {
  if (studentId === store.selectedStudentId) {
    commentInputRef.value?.focus()
    return
  }
  if (!hasComment) {
    selectStudent(studentId)
    return
  }
  emit('copyStudent', studentId)
}

const selectStudent = async (studentId: string): Promise<void> => {
  if (selectedStudent.value?.id === studentId) return
  if (hasUnsavedComment.value) {
    try {
      await ElMessageBox.confirm('当前评语尚未保存，是否保存后切换学生？', '未保存的修改', {
        confirmButtonText: '保存并切换',
        cancelButtonText: '放弃修改',
        distinguishCancelAndClose: true,
        type: 'warning'
      })
      flushDraft()
    } catch (action) {
      if (action !== 'cancel') return
    }
  }
  store.selectStudent(studentId)
}

const handleModeChange = (value: string | number | boolean | undefined): void => {
  if (value === ScoreNoticeModeEnum.Grade) store.mode = value
  if (value === ScoreNoticeModeEnum.Score && canUseScoreMode.value) store.mode = value
}

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

watch(
  () => selectedStudent.value?.id,
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

</script>

<template>
  <aside class="notice-panel">
    <el-scrollbar class="notice-panel__scrollbar">
      <div class="notice-panel__scroll-content">
    <section
      class="notice-panel__section notice-panel__settings"
      :class="{ 'is-collapsed': !expandedSections.settings }"
    >
      <button
        class="notice-panel__step-head"
        type="button"
        data-testid="notice-section-settings"
        :aria-expanded="expandedSections.settings"
        @click="toggleSection('settings')"
      >
        <span class="notice-panel__step">1</span>
        <strong>考试设置</strong>
        <font-awesome-icon
          class="notice-panel__chevron"
          :class="{ 'is-expanded': expandedSections.settings }"
          :icon="['solid', 'chevron-down']"
        />
      </button>
      <div v-show="expandedSections.settings" class="notice-panel__section-body">
        <el-input v-model="store.title" maxlength="28" placeholder="输入通知标题" />
        <div class="notice-panel__setting-row">
          <el-button @click="emit('openImport')">
            <font-awesome-icon :icon="['solid', 'upload']" />
            {{ store.sourceFileName ? '重新导入' : '导入 Excel' }}
          </el-button>
          <el-date-picker
            v-model="store.noticeDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            :clearable="false"
            placeholder="通知日期"
          />
          <el-segmented
            :model-value="store.mode"
            :options="[
              { label: '等级', value: ScoreNoticeModeEnum.Grade },
              { label: '分数', value: ScoreNoticeModeEnum.Score, disabled: !canUseScoreMode }
            ]"
            @change="handleModeChange"
          />
        </div>
        <div v-if="store.sourceFileName" class="notice-panel__file-info">
          <font-awesome-icon :icon="['solid', 'file-excel']" />
          <span>{{ store.sourceFileName }}</span>
          <em>{{ store.students.length }}名学生 · {{ store.subjects.length }}个科目</em>
        </div>
        <div class="notice-panel__font-control">
          <font-awesome-icon :icon="['solid', 'font']" />
          <span :title="handwriteFontName || '默认手写字体'">
            {{ handwriteFontName || '默认手写字体' }}
          </span>
          <el-button
            size="small"
            :loading="handwriteFontApplying"
            @click="emit('chooseHandwriteFont')"
          >
            {{ handwriteFontApplying ? '应用中' : '更换' }}
          </el-button>
          <el-button
            v-if="hasCustomHandwriteFont"
            size="small"
            text
            @click="emit('clearHandwriteFont')"
          >
            默认
          </el-button>
        </div>
      </div>
    </section>

    <section
      class="notice-panel__section notice-panel__students"
      :class="{ 'is-collapsed': !expandedSections.students }"
    >
      <button
        class="notice-panel__step-head notice-panel__step-head--with-status"
        type="button"
        data-testid="notice-section-students"
        :aria-expanded="expandedSections.students"
        @click="toggleSection('students')"
      >
        <span class="notice-panel__step-title">
          <span class="notice-panel__step">2</span><strong>学生评语</strong>
        </span>
        <span class="notice-panel__summary">
          <span class="is-success"
            >已生成 {{ store.generatedCount }}/{{ store.students.length }}</span
          >
          <span v-if="store.pendingCount" class="is-warning">{{ store.pendingCount }}人待生成</span>
          <span v-if="store.reviewCount" class="is-danger">{{ store.reviewCount }}人需修改</span>
          <span v-if="store.missingCount" class="is-danger"
            >{{ store.missingCount }}人缺少数据</span
          >
        </span>
        <font-awesome-icon
          class="notice-panel__chevron"
          :class="{ 'is-expanded': expandedSections.students }"
          :icon="['solid', 'chevron-down']"
        />
      </button>

      <div v-show="expandedSections.students" class="notice-panel__section-body">
        <el-input v-model="searchKeyword" clearable placeholder="搜索学生姓名">
          <template #prefix><font-awesome-icon :icon="['solid', 'magnifying-glass']" /></template>
        </el-input>

        <button
          class="notice-panel__batch-button"
          :class="{ 'is-running': batchGenerating }"
          type="button"
          :disabled="!store.students.length"
          @click="batchGenerating ? emit('stopBatch') : emit('generateBatch')"
        >
          <span>
            <font-awesome-icon
              :icon="['solid', batchGenerating ? 'stop' : 'wand-magic-sparkles']"
            />
            {{ batchGenerating ? '停止生成' : '批量生成/重新生成评语（AI）' }}
          </span>
          <span>{{
            batchGenerating
              ? `${batchProcessed}/${batchTotal}`
              : `已生成 ${store.generatedCount}/${store.students.length}`
          }}</span>
        </button>
        <el-progress
          v-if="store.students.length"
          class="notice-panel__progress"
          :percentage="progressPercentage"
          :show-text="false"
          :stroke-width="4"
        />

        <el-table
          class="notice-panel__student-table"
          :data="filteredStudents"
          max-height="218"
          highlight-current-row
          :current-row-key="store.selectedStudentId"
          row-key="id"
          empty-text="没有匹配的学生"
          @row-click="handleRowClick"
        >
          <el-table-column prop="name" label="学生姓名" min-width="150" />
          <el-table-column label="状态" width="100" align="center">
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
          <el-table-column label="操作" width="64" align="center">
            <template #default="{ row }">
              <button
                class="notice-panel__student-action"
                type="button"
                :aria-label="
                  row.id === store.selectedStudentId
                    ? `编辑${row.name}评语`
                    : row.comment
                      ? `复制${row.name}成绩图片`
                      : `选择${row.name}`
                "
                @click.stop="handleStudentAction(row.id, Boolean(row.comment))"
              >
                <font-awesome-icon :icon="getStudentActionIcon(row.id, Boolean(row.comment))" />
              </button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="selectedStudent" class="notice-panel__editor">
          <div class="notice-panel__editor-head">
            <strong>手动编辑评语</strong>
            <span>该评语将同步更新到左侧预览</span>
            <el-tooltip content="复制评语文字" placement="top">
              <button type="button" aria-label="复制评语文字" @click="copyComment">
                <font-awesome-icon :icon="['regular', 'copy']" />
              </button>
            </el-tooltip>
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
          <div v-if="commentValidationReasons.length" class="notice-panel__editor-warning">
            <font-awesome-icon :icon="['solid', 'triangle-exclamation']" />
            {{ commentValidationReasons.join('；') }}
          </div>
          <div class="notice-panel__editor-actions">
            <el-button
              :loading="singleGenerating"
              @click="emit('generateSingle')"
            >
              <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
              AI生成
            </el-button>
            <span></span>
            <el-button type="primary" @click="saveDraft">
              <font-awesome-icon :icon="['solid', 'check']" />
              保存修改
            </el-button>
          </div>
        </div>
      </div>
    </section>
      </div>
    </el-scrollbar>

    <section class="notice-panel__export">
      <strong class="notice-panel__export-title">导出与发送</strong>
      <div class="notice-panel__export-actions">
        <el-button :disabled="!selectedStudent || exporting" @click="emit('copyImage')">
          <font-awesome-icon :icon="['regular', 'copy']" />
          复制当前图片
        </el-button>
        <el-button
          type="primary"
          :loading="exporting"
          :disabled="!store.students.length"
          @click="emit('exportZip')"
        >
          <font-awesome-icon v-if="!exporting" :icon="['solid', 'download']" />
          {{
            exporting ? `正在导出 ${exportProcessed}/${store.students.length}` : '导出全部图片 ZIP'
          }}
        </el-button>
      </div>
    </section>
  </aside>
</template>

<style scoped lang="scss">
.notice-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color-light);
}
.notice-panel__scrollbar {
  flex: 1;
  min-height: 0;
}
.notice-panel__scroll-content {
  min-height: 100%;
}
.notice-panel__section {
  padding: 14px 18px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.notice-panel__section.is-collapsed {
  padding-top: 12px;
  padding-bottom: 12px;
}
.notice-panel__step-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 11px;
  padding: 0;
  color: var(--el-text-color-primary);
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.notice-panel__section.is-collapsed .notice-panel__step-head {
  margin-bottom: 0;
}
.notice-panel__step-head:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 4px;
  border-radius: 3px;
}
.notice-panel__step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  background: var(--el-color-primary);
  border-radius: 50%;
}
.notice-panel__step-head strong {
  font-size: 15px;
}
.notice-panel__step-title {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 0 0 auto;
}
.notice-panel__chevron {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  transition: transform 0.18s ease;
}
.notice-panel__chevron.is-expanded {
  transform: rotate(180deg);
}
.notice-panel__section-body {
  min-width: 0;
}
.notice-panel__setting-row {
  display: grid;
  grid-template-columns: auto minmax(132px, 1fr) 155px;
  gap: 8px;
  margin-top: 9px;
}
.notice-panel__setting-row :deep(.el-date-editor) {
  width: 100%;
}
.notice-panel__file-info {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin-top: 8px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}
.notice-panel__file-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-panel__file-info em {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-style: normal;
  white-space: nowrap;
}
.notice-panel__font-control {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin-top: 9px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}
.notice-panel__font-control > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-panel__font-control .el-button {
  flex: 0 0 auto;
  margin-left: auto;
}
.notice-panel__font-control .el-button + .el-button {
  margin-left: -2px;
}
.notice-panel__students {
  min-height: 0;
}
.notice-panel__students.is-collapsed {
  min-height: auto;
}
.notice-panel__students > .notice-panel__section-body {
  min-height: 0;
}
.notice-panel__step-head--with-status {
  gap: 12px;
}
.notice-panel__summary {
  display: flex;
  align-items: center;
  gap: 9px !important;
  margin-left: auto;
  font-size: 11px;
}
.notice-panel__summary .is-success {
  color: #169b57;
}
.notice-panel__summary .is-warning {
  color: #d68716;
}
.notice-panel__summary .is-danger {
  color: #e84a4a;
}
.notice-panel__batch-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 39px;
  margin-top: 9px;
  padding: 0 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 5px;
  cursor: pointer;
}
.notice-panel__batch-button span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.notice-panel__batch-button span:last-child {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.notice-panel__batch-button.is-running {
  color: #b5472e;
  background: #fff8f5;
  border-color: #e2a28f;
}
.notice-panel__batch-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.notice-panel__progress {
  margin: -4px 7px 7px;
}
.notice-panel__student-table {
  width: 100%;
  margin-top: 6px;
  --el-table-current-row-bg-color: var(--el-color-primary-light-9);
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
}
.notice-panel__student-table :deep(.el-table__row) {
  cursor: pointer;
}
.notice-panel__student-table :deep(.el-table__cell) {
  padding: 6px 0;
}
.notice-panel__student-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--el-color-primary);
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}
.notice-panel__student-action:hover,
.notice-panel__student-action:focus-visible {
  background: var(--el-color-primary-light-9);
  outline: none;
}
.notice-panel__editor {
  margin-top: 11px;
  padding: 11px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.notice-panel__editor-head {
  display: grid;
  grid-template-columns: auto 1fr 28px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.notice-panel__editor-head strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.notice-panel__editor-head span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  text-align: right;
}
.notice-panel__editor-head button {
  width: 28px;
  height: 28px;
  color: var(--el-color-primary);
  background: transparent;
  border: 0;
  cursor: pointer;
}
.notice-panel__editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.notice-panel__editor-warning {
  margin-top: 7px;
  color: #c2412d;
  font-size: 11px;
}
.notice-panel__editor-warning svg {
  margin-right: 5px;
}
.notice-panel__editor-actions span {
  flex: 1;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.notice-panel__export {
  flex: 0 0 auto;
  padding: 13px 18px 15px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  box-shadow: 0 -4px 12px rgb(0 0 0 / 4%);
}
.notice-panel__export-title {
  display: block;
  margin-bottom: 9px;
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.notice-panel__export-actions {
  display: grid;
  grid-template-columns: 0.9fr 1.35fr;
  gap: 10px;
}
.notice-panel__export-actions .el-button {
  margin: 0;
}
</style>
