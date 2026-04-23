<script setup lang="ts">
import { ref } from 'vue'

import ConfigurationCard from '@/views/evaluation/components/ConfigurationCard.vue'
import EvaluationInputCard from '@/views/evaluation/components/EvaluationInputCard.vue'

import type { StudentDataType } from '@/types/StudentData'

const emit = defineEmits<{
  scroll: [index: number]
  'active-student-change': [student: StudentDataType | null]
}>()

const evaluationInputCardRef = ref<InstanceType<typeof EvaluationInputCard>>()

const autoFocus = () => {
  evaluationInputCardRef.value?.autoFocus()
}

/**
 * 填充学生数据到输入框
 * 点击左侧评语卡片时调用，自动选中该学生并聚焦评语输入框
 * @param row - 学生行数据
 */
const fillStudentData = (row: StudentDataType) => {
  evaluationInputCardRef.value?.editData(row)
}

const resetForm = () => {
  evaluationInputCardRef.value?.resetForm()
}

defineExpose({
  autoFocus,
  fillStudentData,
  resetForm
})
</script>

<template>
  <div class="tool-panel-view__wrapper">
    <configuration-card />

    <div class="input-section">
      <evaluation-input-card
        ref="evaluationInputCardRef"
        :auto-next-on-submit="true"
        :prompt-unsaved-on-switch="true"
        :inline-comment-actions="true"
        @scroll="(index) => emit('scroll', index)"
        @active-student-change="(student) => emit('active-student-change', student)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.tool-panel-view__wrapper {
  padding: 0 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
