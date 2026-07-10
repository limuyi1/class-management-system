<script setup lang="ts">
import { computed } from 'vue'

import { useEvaluationInput } from '@/hooks/useEvaluationInput'

import StudentSelectField from '@/views/evaluation/components/input/StudentSelectField.vue'
import CommentInputForm from '@/views/evaluation/components/input/CommentInputForm.vue'

import type { StudentDataType } from '@/types/StudentData'

interface Props {
  autoNextOnSubmit?: boolean
  promptUnsavedOnSwitch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoNextOnSubmit: true,
  promptUnsavedOnSwitch: true
})

const emit = defineEmits<{
  scroll: [studentId: string]
  activeStudentChange: [data: StudentDataType | null]
}>()

const {
  originList,
  tagCategoryList,
  generating,
  polishing,
  optionsList,
  formData,
  currentStudentTags,
  hasAnyTags,
  nameInputRef,
  commentInputRef,
  autoFocus,
  remoteMethod,
  selectChange,
  onSubmit,
  resetForm,
  editData,
  goToEditTags,
  handleGenerateComment,
  handlePolishComment
} = useEvaluationInput({
  autoNextOnSubmit: props.autoNextOnSubmit,
  promptUnsavedOnSwitch: props.promptUnsavedOnSwitch,
  onActiveStudentChange: (student) => emit('activeStudentChange', student),
  onScroll: (studentId) => emit('scroll', studentId)
})

const canGenerateComment = computed(() => !!formData.studentId)
const canPolishComment = computed(() => !!formData.studentId && !!formData.comment?.trim())
const submitText = computed(() => (props.autoNextOnSubmit ? '保存并下一个' : '提 交'))

const handleEditData = (data: StudentDataType) => {
  editData(data)
}

defineExpose({
  editData: handleEditData,
  resetForm,
  autoFocus
})
</script>

<template>
  <div class="evaluation-input-card">
    <div class="card-header">
      <font-awesome-icon :icon="['solid', 'pen-to-square']" />
      <span>填写期末评语</span>
    </div>

    <div class="card-body">
      <el-form label-position="top" :model="formData">
        <div class="editor-section">
          <student-select-field
            ref="nameInputRef"
            :model-value="formData.studentId"
            :options="optionsList"
            :origin-list="originList"
            :remote-method="remoteMethod"
            @update:model-value="(value) => (formData.studentId = value)"
            @change="selectChange"
          />

          <comment-input-form
            ref="commentInputRef"
            :model-value="formData.comment"
            :disabled="!formData.studentId"
            :current-student-tags="currentStudentTags"
            :hasAnyTags="hasAnyTags"
            :tag-category-list="tagCategoryList"
            @update:model-value="(value) => (formData.comment = value)"
            @go-edit-tags="goToEditTags"
          />
        </div>

        <div class="action-section">
          <el-form-item>
            <div class="action-row">
              <el-tooltip disabled placement="top">
                <div class="action-item">
                  <el-button
                    class="ai-generate-btn"
                    size="default"
                    round
                    :disabled="!canGenerateComment"
                    :loading="generating"
                    @click="handleGenerateComment"
                  >
                    <template #icon
                      ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
                    /></template>
                    AI 生成评语
                  </el-button>
                </div>
              </el-tooltip>

              <div class="action-item">
                <el-button
                  class="ai-polish-btn"
                  size="default"
                  round
                  :disabled="!canPolishComment"
                  :loading="polishing"
                  @click="handlePolishComment"
                >
                  <template #icon
                    ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
                  /></template>
                  一键润色
                </el-button>
              </div>

              <div class="action-item">
                <el-button
                  class="submit-btn"
                  type="primary"
                  size="default"
                  round
                  :disabled="!formData.studentId"
                  @click="onSubmit"
                >
                  <template #icon><font-awesome-icon :icon="['solid', 'paper-plane']" /></template>
                  {{ submitText }}
                </el-button>
              </div>
            </div>
          </el-form-item>
        </div>
      </el-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.evaluation-input-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  .card-body {
    padding: 10px 12px;
  }
}

.editor-section,
.action-section {
  border: 1px solid #e7edf5;
  border-radius: 8px;
  background: #fff;
}

.editor-section {
  padding: 10px;
}

.action-section {
  margin-top: 10px;
  padding: 10px 10px 2px;
}

.action-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-item {
  flex: 1;
  min-width: 0;
}

.submit-btn,
.ai-generate-btn,
.ai-polish-btn {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--theme-gradient);
  color: #fff;
  font-size: 13px;
  font-weight: 600;

  svg {
    font-size: 14px;
  }
}

.submit-btn {
  height: 36px;
  font-size: 14px;
  background: var(--theme-gradient);
  border: none;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: #cbd5e1;
  }
}

.ai-generate-btn {
  height: 36px;
  font-size: 14px;
}

.ai-polish-btn {
  height: 36px;
  font-size: 14px;
}

@media (max-width: 1320px) {
  .action-row {
    flex-wrap: wrap;
  }

  .action-item {
    min-width: 100%;
  }
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #64748b;
  font-size: 12px;
}

:deep(.el-form-item) {
  margin-bottom: 10px;
}

:deep(.el-select__wrapper),
:deep(.el-input-number),
:deep(.el-textarea__inner) {
  border-radius: 6px;
}
</style>
