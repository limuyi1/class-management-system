<script setup lang="ts">
/**
 * 成绩通知制作流程面板
 * 组合导入、设置、评语三大步骤与导出栏，并管理步骤展开状态。
 */
import { ref, shallowRef, watch } from 'vue'

import ScoreNoticeCommentWorkspace from '@/views/score-notice/components/ScoreNoticeCommentWorkspace.vue'
import ScoreNoticeExportBar from '@/views/score-notice/components/ScoreNoticeExportBar.vue'
import ScoreNoticeImportStep from '@/views/score-notice/components/ScoreNoticeImportStep.vue'
import ScoreNoticeSettingsStep from '@/views/score-notice/components/ScoreNoticeSettingsStep.vue'
import { useScoreNoticeStore } from '@/stores/score-notice'

interface Props {
  aiConfigured: boolean
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

type StepType = 1 | 2 | 3
type BatchGenerateModeType = 'skip' | 'overwrite'

defineProps<Props>()

const emit = defineEmits<{
  openImport: []
  generateBatch: [mode: BatchGenerateModeType]
  stopBatch: []
  generateSingle: []
  chooseHandwriteFont: []
  clearHandwriteFont: []
  copyImage: []
  exportZip: []
}>()

const store = useScoreNoticeStore()
// 已导入数据时默认展开设置步骤，否则只展开导入步骤
const expandedSteps = ref<Array<StepType>>(store.students.length ? [2] : [1])
const hasUnsavedComment = shallowRef(false)
const commentWorkspaceRef = ref<InstanceType<typeof ScoreNoticeCommentWorkspace> | null>(null)

/** 判断指定步骤是否处于展开状态 */
const isStepExpanded = (step: StepType): boolean => expandedSteps.value.includes(step)

/** 展开指定步骤（已展开时无操作） */
const expandStep = (step: StepType): void => {
  if (isStepExpanded(step)) return
  expandedSteps.value = [...expandedSteps.value, step]
}

/** 切换步骤展开/收起（无学生数据时不允许进入后续步骤） */
const toggleStep = (step: StepType): void => {
  if (step > 1 && !store.students.length) return
  expandedSteps.value = isStepExpanded(step)
    ? expandedSteps.value.filter((expandedStep) => expandedStep !== step)
    : [...expandedSteps.value, step]
}

/** 通过 ref 将评语草稿传递给子工作区 */
const setCommentDraft = (comment: string): void => {
  commentWorkspaceRef.value?.setCommentDraft(comment)
}

defineExpose({ setCommentDraft })

watch(
  () => [store.sourceFileName, store.students.length] as const,
  ([sourceFileName, studentCount], [previousSourceFileName, previousStudentCount]) => {
    // 无数据时回到导入步骤；首次导入或更换文件时自动展开设置步骤
    if (!studentCount) {
      expandedSteps.value = [1]
      return
    }
    if (!previousStudentCount || sourceFileName !== previousSourceFileName) expandStep(2)
  }
)
</script>

<template>
  <aside class="notice-panel" aria-label="成绩通知制作步骤">
    <div class="notice-panel__intro">
      <span>制作流程</span>
      <small>按步骤完成，预览会实时更新</small>
    </div>

    <el-scrollbar class="notice-panel__scrollbar">
      <div class="notice-panel__scroll-content">
        <score-notice-import-step
          :expanded="isStepExpanded(1)"
          @toggle="toggleStep(1)"
          @open-import="emit('openImport')"
        />

        <score-notice-settings-step
          :expanded="isStepExpanded(2)"
          :disabled="!store.students.length"
          :handwrite-font-name="handwriteFontName"
          :has-custom-handwrite-font="hasCustomHandwriteFont"
          :handwrite-font-applying="handwriteFontApplying"
          @toggle="toggleStep(2)"
          @choose-handwrite-font="emit('chooseHandwriteFont')"
          @clear-handwrite-font="emit('clearHandwriteFont')"
        />

        <score-notice-comment-workspace
          ref="commentWorkspaceRef"
          :expanded="isStepExpanded(3)"
          :disabled="!store.students.length"
          :ai-configured="aiConfigured"
          :batch-generating="batchGenerating"
          :batch-processed="batchProcessed"
          :batch-total="batchTotal"
          :single-generating="singleGenerating"
          @toggle="toggleStep(3)"
          @dirty-change="hasUnsavedComment = $event"
          @generate-batch="(mode) => emit('generateBatch', mode)"
          @stop-batch="emit('stopBatch')"
          @generate-single="emit('generateSingle')"
          @copy-image="emit('copyImage')"
        />
      </div>
    </el-scrollbar>

    <score-notice-export-bar
      :exporting="exporting"
      :export-processed="exportProcessed"
      :processing="batchGenerating"
      :has-unsaved-comment="hasUnsavedComment"
      @copy-image="emit('copyImage')"
      @export-zip="emit('exportZip')"
    />
  </aside>
</template>

<style scoped lang="scss">
.notice-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color-light);
}
.notice-panel__intro {
  display: flex;
  flex: 0 0 auto;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 18px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-extra-light);
  border-bottom: 1px solid var(--el-border-color-light);
}
.notice-panel__intro span {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.notice-panel__intro small {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}
.notice-panel__scrollbar {
  flex: 1;
  min-height: 0;
}
.notice-panel__scroll-content {
  min-height: 100%;
}
</style>
