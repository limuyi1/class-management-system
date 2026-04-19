<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  modelValue: number | null
  disabled: boolean
}

interface Emits {
  (event: 'update:modelValue', value: number | null): void
  (event: 'submit'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const scoreInputRef = ref<{ focus: () => void } | null>(null)

const focus = () => {
  scoreInputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <el-form-item label="考试成绩">
    <el-input-number
      ref="scoreInputRef"
      style="width: 100%"
      :model-value="modelValue"
      size="default"
      :min="0"
      :max="100"
      :precision="1"
      :disabled="disabled"
      placeholder="0~100分"
      @update:model-value="(value: unknown) => emit('update:modelValue', value as number | null)"
      @keyup.enter="emit('submit')"
    />
  </el-form-item>
</template>
