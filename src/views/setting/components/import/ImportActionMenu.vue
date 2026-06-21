<script setup lang="ts">
interface Props {
  hasStudentData: boolean
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  initial: []
  score: []
  comment: []
}>()

const handleCommand = (command: 'score' | 'comment') => {
  if (command === 'score') {
    emit('score')
    return
  }
  emit('comment')
}
</script>

<template>
  <el-dropdown v-if="hasStudentData" trigger="click" :disabled="loading" @command="handleCommand">
    <el-button type="success" size="large" :loading="loading">
      <template #icon><font-awesome-icon :icon="['solid', 'upload']" /></template>
      导入数据
      <font-awesome-icon class="import-action-menu__arrow" :icon="['solid', 'chevron-down']" />
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="score">添加成绩</el-dropdown-item>
        <el-dropdown-item command="comment">添加评语</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <el-button v-else type="success" size="large" :loading="loading" @click="emit('initial')">
    <template #icon><font-awesome-icon :icon="['solid', 'upload']" /></template>
    导入
  </el-button>
</template>

<style scoped lang="scss">
.import-action-menu__arrow {
  margin-left: 8px;
  font-size: 11px;
}
</style>
