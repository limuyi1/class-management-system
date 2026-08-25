<script setup lang="ts">
/**
 * 评语工具面板
 * 组合预览配置卡片与评语录入卡片，并向父组件转发滚动与激活学生事件。
 */
import { ref } from 'vue'

import ConfigurationCard from '@/views/evaluation/components/ConfigurationCard.vue'
import EvaluationInputCard from '@/views/evaluation/components/EvaluationInputCard.vue'

import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'

/** 工具面板的 Props */
interface Props {
  students?: StudentDataType[]
  tagCategoryList?: TagCategoryType[]
  allowTagEditing?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  scroll: [studentId: string]
  'active-student-change': [student: StudentDataType | null]
}>()

/** 评语录入卡片的组件引用 */
const evaluationInputCardRef = ref<InstanceType<typeof EvaluationInputCard>>()

/** 聚焦到评语输入区域 */
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

/** 重置评语输入表单 */
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
        :students="students"
        :tag-category-list="tagCategoryList"
        :allow-tag-editing="allowTagEditing"
        @scroll="(studentId) => emit('scroll', studentId)"
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
