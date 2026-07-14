<script setup lang="ts">
import type { UploadFile, UploadFiles } from 'element-plus'

/**
 * 公共 Excel 文件入口。
 *
 * 只统一文件选择/拖拽的外观和 Element Plus 事件格式，不读取文件、不保存业务状态；
 * 调用方应把 change 事件交给 useExcelPreviewImport，再处理各自的字段映射。
 */
interface Props {
  fileName?: string
  description?: string
}

defineProps<Props>()

const emit = defineEmits<{
  change: [file: UploadFile]
}>()

const handleChange = (file: UploadFile, files: UploadFiles): void => {
  void files
  emit('change', file)
}
</script>

<template>
  <el-upload
    class="excel-file-dropzone"
    drag
    accept=".xlsx,.xls"
    :auto-upload="false"
    :show-file-list="false"
    :on-change="handleChange"
  >
    <font-awesome-icon class="excel-file-dropzone__icon" :icon="['solid', 'file-excel']" />
    <div class="excel-file-dropzone__content">
      <strong>{{ fileName || '选择或拖入 Excel 文件' }}</strong>
      <span v-if="description">{{ description }}</span>
    </div>
  </el-upload>
</template>

<style scoped lang="scss">
.excel-file-dropzone {
  :deep(.el-upload) {
    width: 100%;
  }

  :deep(.el-upload-dragger) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    width: 100%;
  }
}

.excel-file-dropzone__icon {
  color: #15803d;
  font-size: 28px;
}

.excel-file-dropzone__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;

  strong {
    color: #1f2937;
    font-size: 14px;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}
</style>
