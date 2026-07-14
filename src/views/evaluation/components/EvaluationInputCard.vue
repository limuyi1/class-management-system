<script setup lang="ts">
import { computed, toRef } from 'vue'

import { useEvaluationInput } from '@/hooks/useEvaluationInput'

import StudentSelectField from '@/views/evaluation/components/input/StudentSelectField.vue'
import CommentInputForm from '@/views/evaluation/components/input/CommentInputForm.vue'

import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'

interface Props {
  autoNextOnSubmit?: boolean
  promptUnsavedOnSwitch?: boolean
  students?: StudentDataType[]
  tagCategoryList?: TagCategoryType[]
  allowTagEditing?: boolean
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
  allowTagEditing,
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
  students: props.students
    ? (toRef(props, 'students') as unknown as import('vue').Ref<StudentDataType[]>)
    : undefined,
  tagCategoryList: props.tagCategoryList
    ? (toRef(props, 'tagCategoryList') as unknown as import('vue').Ref<TagCategoryType[]>)
    : undefined,
  allowTagEditing: props.allowTagEditing,
  onActiveStudentChange: (student) => emit('activeStudentChange', student),
  onScroll: (studentId) => emit('scroll', studentId)
})

const canGenerateComment = computed(() => !!formData.studentId)
const canPolishComment = computed(() => !!formData.studentId && !!formData.comment?.trim())
const aiActionText = computed(() => (canPolishComment.value ? 'AI 润色' : 'AI 生成'))
const aiProcessing = computed(() => generating.value || polishing.value)
const submitText = computed(() => (props.autoNextOnSubmit ? '保存并下一个' : '提 交'))

const handleAiAction = (command: string | number | object): void => {
  if (command === 'generate') {
    void handleGenerateComment()
    return
  }
  if (command === 'polish') void handlePolishComment()
}

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
            :allow-tag-editing="allowTagEditing"
            @update:model-value="(value) => (formData.comment = value)"
            @go-edit-tags="goToEditTags"
          />
        </div>

        <div class="action-section">
          <el-form-item>
            <div class="action-row">
              <el-dropdown
                trigger="click"
                placement="bottom-start"
                :disabled="!canGenerateComment || aiProcessing"
                @command="handleAiAction"
              >
                <el-button
                  class="ai-assistant-btn"
                  :disabled="!canGenerateComment"
                  :loading="aiProcessing"
                >
                  <template #icon>
                    <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
                  </template>
                  {{ aiActionText }}
                  <font-awesome-icon class="dropdown-arrow" :icon="['solid', 'chevron-down']" />
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="generate">
                      <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
                      <span>{{ canPolishComment ? '重新生成评语' : '生成评语' }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="polish" :disabled="!canPolishComment">
                      <font-awesome-icon :icon="['solid', 'pen-nib']" />
                      <span>润色当前评语</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <el-button
                class="submit-btn"
                type="primary"
                :disabled="!formData.studentId"
                @click="onSubmit"
              >
                <template #icon><font-awesome-icon :icon="['solid', 'paper-plane']" /></template>
                {{ submitText }}
              </el-button>
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
  justify-content: flex-end;
  gap: 10px;
}

.submit-btn,
.ai-assistant-btn {
  min-width: 132px;
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
  min-width: 150px;
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

.ai-assistant-btn {
  height: 36px;
  font-size: 14px;
}

.dropdown-arrow {
  margin-left: 7px;
  font-size: 10px;
  opacity: 0.65;
}

@media (max-width: 1320px) {
  .action-row {
    flex-wrap: wrap;
  }

  .submit-btn,
  .ai-assistant-btn {
    flex: 1;
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
