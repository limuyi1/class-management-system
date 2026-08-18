<script setup lang="ts">
/**
 * 评语数据源选择栏
 * 包装学生来源选择器，向上转发切换与上传事件。
 */
import StudentSourceSelector from '@/components/student-source/StudentSourceSelector.vue'

import type { CommentWorkspaceSourceType } from '@/types/CommentWorkspace'

/** 数据源选择栏的 Props */
interface Props {
  source: CommentWorkspaceSourceType
  systemStudentCount: number
  excelFileName?: string
  excelStudentCount?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  change: [source: CommentWorkspaceSourceType]
  upload: []
}>()

/**
 * 处理来源切换命令；系统源无学生时不切换。
 *
 * @param command 来源命令
 */
const handleSourceCommand = (command: string): void => {
  if (command === 'system') {
    if (props.systemStudentCount > 0) emit('change', 'system')
    return
  }
  if (command === 'excel') {
    emit('change', 'excel')
    return
  }
  if (command === 'upload') emit('upload')
}

defineExpose({ handleSourceCommand })
</script>

<template>
  <div class="comment-source-bar">
    <student-source-selector
      :source="source"
      :system-student-count="systemStudentCount"
      :excel-file-name="excelFileName"
      :excel-student-count="excelStudentCount"
      @change="emit('change', $event)"
      @upload="emit('upload')"
    >
      <template #actions><slot name="actions" /></template>
    </student-source-selector>
  </div>
</template>

<style scoped lang="scss">
.comment-source-bar {
  min-height: 52px;
  margin-bottom: 10px;
  padding: 7px 9px 7px 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 5px 16px rgba(15, 23, 42, 0.035);
}

.comment-source-bar :deep(.student-source-selector__actions) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: 1;
}
</style>
