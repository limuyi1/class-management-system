<script setup lang="ts">
import { computed } from 'vue'

import { useStudentInput } from '@/hooks/useStudentInput'

import StudentSelectField from '@/views/score/components/input/StudentSelectField.vue'
import ScoreInputForm from '@/views/score/components/input/ScoreInputForm.vue'
import CommentInputForm from '@/views/score/components/input/CommentInputForm.vue'

import { InputEnum } from '@/types/Common'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  type?: InputEnum
}

const props = withDefaults(defineProps<Props>(), {
  type: InputEnum.SCORE
})

const emit = defineEmits<{
  scroll: [index: number]
}>()

const {
  originList,
  tagCategoryList,
  generating,
  optionsList,
  formData,
  currentStudentTags,
  hasAnyTags,
  nameInputRef,
  scoreInputRef,
  commentInputRef,
  autoFocus,
  remoteMethod,
  selectChange,
  onSubmit,
  editData,
  goToEditTags,
  handleGenerateComment
} = useStudentInput({
  type: props.type,
  onScroll: (index) => emit('scroll', index)
})

const isCommentMode = computed(() => props.type === InputEnum.COMMENT)
const canGenerateComment = computed(() => !!formData.id && hasAnyTags.value)

const handleEditData = (data: StudentDataType) => {
  editData(data)
}

defineExpose({
  editData: handleEditData,
  autoFocus
})
</script>

<template>
  <div class="input-card">
    <div class="card-header">
      <font-awesome-icon :icon="['solid', 'pen-to-square']" />
      <span>{{ isCommentMode ? '填写评语' : '输入分数' }}</span>
    </div>

    <div class="card-body">
      <el-form label-position="top" :model="formData">
        <student-select-field
          ref="nameInputRef"
          :model-value="formData.id"
          :options="optionsList"
          :origin-list="originList"
          :remote-method="remoteMethod"
          @update:model-value="(value) => (formData.id = value)"
          @change="selectChange"
        />

        <score-input-form
          v-if="!isCommentMode"
          ref="scoreInputRef"
          :model-value="formData.score"
          :disabled="!formData.id"
          @update:model-value="(value) => (formData.score = value)"
          @submit="onSubmit"
        />

        <comment-input-form
          v-if="isCommentMode"
          ref="commentInputRef"
          :model-value="formData.comment"
          :disabled="!formData.id"
          :current-student-tags="currentStudentTags"
          :hasAnyTags="hasAnyTags"
          :tag-category-list="tagCategoryList"
          :generating="generating"
          :can-generate="canGenerateComment"
          @update:model-value="(value) => (formData.comment = value)"
          @go-edit-tags="goToEditTags"
          @generate-comment="handleGenerateComment"
        />

        <el-form-item>
          <el-button
            class="submit-btn"
            style="width: 100%"
            type="primary"
            size="default"
            round
            :disabled="!formData.id"
            @click="onSubmit"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'paper-plane']" /></template>
            提 交
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.input-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  .card-body {
    padding: 10px 12px;
  }
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
