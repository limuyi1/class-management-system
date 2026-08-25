<script setup lang="ts">
/** 图片尺寸与位置设置弹窗 — 调整插入图片的缩放比例与对齐方式 */
import { ElDialog, ElSelect, ElOption, ElRadioGroup, ElRadioButton, ElButton } from 'element-plus'

/** 弹窗可见性、缩放比例、对齐方式与原始图片宽度 */
interface Props {
  visible: boolean
  imageScale: number
  imageAlign: 'left' | 'center' | 'right'
  originalImageWidth: number
}

const props = defineProps<Props>()

/** 可见性、缩放、对齐的更新事件与确认事件 */
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:imageScale': [value: number]
  'update:imageAlign': [value: 'left' | 'center' | 'right']
  confirm: [scale: number, align: 'left' | 'center' | 'right']
}>()

/** 可选的缩放比例档位 */
const scaleOptions = [
  { label: '20%', value: 20 },
  { label: '40%', value: 40 },
  { label: '60%', value: 60 },
  { label: '80%', value: 80 },
  { label: '100%', value: 100 },
  { label: '200%', value: 200 }
]

/** 确认当前缩放与对齐设置并关闭弹窗 */
const handleConfirm = () => {
  emit('confirm', props.imageScale, props.imageAlign)
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="设置图片尺寸和位置"
    width="450px"
    append-to-body
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <!-- 缩放比例与对齐方式设置 -->
    <div class="image-settings">
      <div class="setting-row">
        <span class="label">缩放比例：</span>
        <el-select
          :model-value="imageScale"
          placeholder="请选择"
          @update:model-value="(val) => emit('update:imageScale', val)"
        >
          <el-option
            v-for="opt in scaleOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <span class="preview-width">
          (约 {{ Math.round(originalImageWidth * (imageScale / 100)) }}px)
        </span>
      </div>
      <div class="setting-row">
        <span class="label">对齐方式：</span>
        <el-radio-group
          :model-value="imageAlign"
          @update:model-value="
            (val) => emit('update:imageAlign', val as 'left' | 'center' | 'right')
          "
        >
          <el-radio-button value="left">居左</el-radio-button>
          <el-radio-button value="center">居中</el-radio-button>
          <el-radio-button value="right">居右</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.image-settings {
  .setting-row {
    display: flex;
    align-items: center;
    margin-bottom: 20px;

    .label {
      width: 80px;
      font-size: 14px;
      color: #606266;
    }

    .el-select {
      width: 120px;
    }

    .preview-width {
      margin-left: 12px;
      font-size: 13px;
      color: #909399;
    }
  }
}
</style>
