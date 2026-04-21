<script setup lang="ts">
import { ref } from 'vue'

import ConfigurationCard from '@/views/evaluation/components/ConfigurationCard.vue'
import InputCard from '@/views/score/components/InputCard.vue'

import { InputEnum } from '@/types/Common'
import type { StudentDataType } from '@/types/StudentData'

const emit = defineEmits(['scroll', 'active-student-change'])

const inputCardRef = ref<InstanceType<typeof InputCard>>()

const autoFocus = () => {
  inputCardRef.value?.autoFocus()
}

/**
 * 填充学生数据到输入框
 * 点击左侧评语卡片时调用，自动选中该学生并聚焦评语输入框
 * @param row - 学生行数据
 */
const fillStudentData = (row: StudentDataType) => {
  inputCardRef.value?.editData(row)
}

defineExpose({
  autoFocus,
  fillStudentData
})
</script>

<template>
  <div class="tool-panel-view__wrapper">
    <configuration-card />

    <div class="input-section">
      <input-card
        ref="inputCardRef"
        :type="InputEnum.COMMENT"
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
