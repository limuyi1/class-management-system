<script setup lang="ts">
/** 常用 PDF 与预览保留入口，其他格式和拼版选项收拢，避免底栏拥挤。 */
defineProps<{
  disabled: boolean
  busy: boolean
  saving: boolean
  dirty: boolean
  hasStudents: boolean
}>()
const fourUp = defineModel<boolean>('fourUp', { required: true })
const emit = defineEmits<{
  preview: []
  save: []
  export: [format: 'png' | 'zip' | 'pdf']
  stop: []
}>()
</script>
<template>
  <span class="card-export__status">{{
    hasStudents ? '检查预览后即可批量导出' : '请点击上方“选择学生”'
  }}</span>
  <el-button :disabled="disabled" @click="emit('save')" :loading="saving"
    >保存模板{{ dirty ? ' *' : '' }}</el-button
  >
  <el-button :disabled="disabled" @click="emit('preview')">成品预览</el-button>
  <el-popover placement="top-end" width="230" trigger="click">
    <template #reference><el-button :disabled="disabled">导出选项</el-button></template>
    <div class="card-export__options">
      <el-checkbox v-model="fourUp" :disabled="disabled">PDF 四联拼版（A4）</el-checkbox>
      <small>关闭拼版时，PDF 按模板尺寸每人一页。</small>
      <el-button :disabled="disabled || !hasStudents" @click="emit('export', 'png')"
        >导出当前学生 PNG</el-button
      >
      <el-button :disabled="disabled || !hasStudents" @click="emit('export', 'zip')"
        >导出全部图片 ZIP</el-button
      >
    </div>
  </el-popover>
  <el-button type="primary" :disabled="disabled || !hasStudents" @click="emit('export', 'pdf')"
    >批量导出 PDF</el-button
  >
  <el-button v-if="busy" @click="emit('stop')">停止</el-button>
</template>
<style scoped lang="scss">
.card-export__status {
  margin-right: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.card-export__options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-export__options :deep(.el-button) {
  margin: 0;
}
small {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
</style>
