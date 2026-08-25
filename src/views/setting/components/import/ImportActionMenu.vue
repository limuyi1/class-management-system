<script setup lang="ts">
/**
 * 导入动作按钮：根据是否已有学生数据切换为“添加成绩”或“导入”，
 * 并向上抛出 initial/score 事件交由父组件触发对应导入流程。
 */
/** 组件入参：是否已有学生数据、导入进行中的加载状态 */
interface Props {
  hasStudentData: boolean
  loading: boolean
}

defineProps<Props>()

/** 事件：initial 触发初始化导入，score 触发增量成绩导入 */
const emit = defineEmits<{
  initial: []
  score: []
}>()
</script>

<template>
  <!-- 已有学生数据时展示“添加成绩”，否则展示“导入” -->
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
