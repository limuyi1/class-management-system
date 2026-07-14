<script setup lang="ts">
interface Props {
  hasStudentData: boolean
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  initial: []
  score: []
}>()
</script>

<template>
  <el-button
    v-if="hasStudentData"
    type="success"
    size="large"
    :loading="loading"
    @click="emit('score')"
  >
    <template #icon><font-awesome-icon :icon="['solid', 'upload']" /></template>
    添加成绩
  </el-button>

  <el-button v-else type="success" size="large" :loading="loading" @click="emit('initial')">
    <template #icon><font-awesome-icon :icon="['solid', 'upload']" /></template>
    导入
  </el-button>
</template>
