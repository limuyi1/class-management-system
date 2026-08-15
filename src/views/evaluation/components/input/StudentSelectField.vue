<script setup lang="ts">
import { computed, ref } from 'vue'

import type { StudentDataType } from '@/types/StudentData'
import { NAME_PROP } from '@/constants'

interface Props {
  modelValue: string | null
  options: StudentDataType[]
  originList: StudentDataType[]
  remoteMethod: (query: string) => void
}

interface Emits {
  (event: 'update:modelValue', value: string | null): void
  (event: 'change', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectRef = ref<{ focus: () => void } | null>(null)

const selectableOptions = computed(() =>
  props.options.filter((item) => props.originList.some((student) => student.studentId === item.studentId))
)

const getName = (item: StudentDataType) => {
  const name = item[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

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
