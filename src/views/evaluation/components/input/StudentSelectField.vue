<script setup lang="ts">
import { computed, ref } from 'vue'

import type { StudentDataType } from '@/types/StudentData'
import { NAME_PROP } from '@/types/Constants'

interface Props {
  modelValue: number | null
  options: StudentDataType[]
  originList: StudentDataType[]
  remoteMethod: (query: string) => void
}

interface Emits {
  (event: 'update:modelValue', value: number | null): void
  (event: 'change', value: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectRef = ref<{ focus: () => void } | null>(null)

const optionsWithIndex = computed(() => {
  return props.options.map((item) => ({
    item,
    index: props.originList.indexOf(item) + 1
  }))
})

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
      @update:model-value="(value: unknown) => emit('update:modelValue', (value as number) || null)"
      @change="(value: unknown) => emit('change', value as number)"
    >
      <el-option
        v-for="entry in optionsWithIndex"
        :key="entry.index"
        :label="getName(entry.item)"
        :value="entry.index"
      />
    </el-select>
  </el-form-item>
</template>
