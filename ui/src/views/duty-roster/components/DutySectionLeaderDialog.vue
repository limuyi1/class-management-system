<script setup lang="ts">
import { shallowRef, watch } from 'vue'

import type { StudentSourceStudentType } from '@/types/StudentSource'

const props = defineProps<{
  modelValue: boolean
  sectionName: string
  students: StudentSourceStudentType[]
  leaderStudentId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [studentId?: string]
}>()

const selectedStudentId = shallowRef<string | undefined>()

watch(
  () => [props.modelValue, props.leaderStudentId] as const,
  ([visible, leaderStudentId]) => {
    if (visible) selectedStudentId.value = leaderStudentId
  },
  { immediate: true }
)

/** 保存当前区域的大组长；清空选择表示取消设置。 */
function confirm(): void {
  emit('confirm', selectedStudentId.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`设置${sectionName}大组长`"
    width="420px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="学生">
        <el-select
          v-model="selectedStudentId"
          class="duty-section-leader-dialog__select"
          filterable
          clearable
          placeholder="请选择学生"
        >
          <el-option
            v-for="student in students"
            :key="student.id"
            :label="student.name"
            :value="student.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <p class="duty-section-leader-dialog__tip">姓名会显示在顶部区域标题中。</p>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="confirm">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.duty-section-leader-dialog__select {
  width: 100%;
}

.duty-section-leader-dialog__tip {
  margin: -4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
