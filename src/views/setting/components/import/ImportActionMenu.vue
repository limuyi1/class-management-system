<script setup lang="ts">
/**
 * 导入动作按钮：根据是否已有学生数据切换为“添加成绩”或“导入”，
 * 并向上抛出 initial/score 事件交由父组件触发对应导入流程。
 */
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
