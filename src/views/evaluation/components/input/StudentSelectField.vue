<script setup lang="ts">
/**
 * 学生选择下拉框
 * 支持远程搜索，仅展示存在于原始学生列表中的选项。
 */
import { computed, ref } from 'vue'

import type { StudentDataType } from '@/types/StudentData'
import { NAME_PROP } from '@/constants'

/** 学生选择字段的 Props */
interface Props {
  modelValue: string | null
  options: StudentDataType[]
  originList: StudentDataType[]
  remoteMethod: (query: string) => void
}

/** 学生选择字段的 Emits */
interface Emits {
  (event: 'update:modelValue', value: string | null): void
  (event: 'change', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectRef = ref<{ focus: () => void } | null>(null)

/** 仅保留原始列表中存在对应 studentId 的候选项，避免选中已删除的学生 */
const selectableOptions = computed(() =>
  props.options.filter((item) => props.originList.some((student) => student.studentId === item.studentId))
)

/** 读取学生姓名并兜底为空字符串 */
const getName = (item: StudentDataType) => {
  const name = item[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

/** 聚焦下拉框 */
const focus = () => {
  selectRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <el-form-item label="学生姓名">
    <el-select
      ref="selectRef"
      name="stuName"
      style="width: 100%"
      :model-value="modelValue"
      size="default"
      placeholder="搜索学生姓名..."
      filterable
      remote
      :remote-method="remoteMethod"
      @update:model-value="(value: unknown) => emit('update:modelValue', (value as string) || null)"
      @change="(value: unknown) => emit('change', value as string)"
    >
      <el-option
        v-for="student in selectableOptions"
        :key="student.studentId"
        :label="getName(student)"
        :value="student.studentId"
      />
    </el-select>
  </el-form-item>
</template>
