<script setup lang="ts">
/** 题目原始图片区 — 上传、裁剪、预览与移除单张原始图片 */
import { ref } from 'vue'
import { ElFormItem, ElButton, ElImageViewer } from 'element-plus'
import { ElMessage } from 'element-plus'
import { fileToBase64 } from '@/utils/fileUtil'
import ImageCropper from '@/components/ImageCropper.vue'

interface Props {
  images: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:images': [value: string[]]
  'insert-image': [base64: string]
}>()

const cropperVisible = ref(false)
const cropperImageSrc = ref('')
const imagePreviewVisible = ref(false)
const imagePreviewUrl = ref('')

/** 选择图片文件并打开裁剪器，仅允许上传一张原始图片 */
const handleAddImage = () => {
  if (props.images.length >= 1) {
    ElMessage.warning('题目图片只能上传一张')
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      ElMessage.warning('请上传图片文件')
      return
    }

    try {
      const base64 = await fileToBase64(file)
      const imageUrl = `data:image/jpeg;base64,${base64}`
      cropperImageSrc.value = imageUrl
      cropperVisible.value = true
    } catch (error) {
      console.error('读取图片失败:', error)
      ElMessage.error('读取图片失败')
    }
  }
  input.click()
}

const handleCropConfirm = (croppedBase64: string) => {
  cropperVisible.value = false
  emit('update:images', [...props.images, croppedBase64])
}

/** 取消裁剪 */
const handleCropCancel = () => {
  cropperVisible.value = false
}

/**
 * 移除指定位置的图片
 * @param index - 图片下标
 */
const handleRemoveImage = (index: number) => {
  const newImages = [...props.images]
  newImages.splice(index, 1)
  emit('update:images', newImages)
}

/**
 * 点击图片打开大图预览
 * @param index - 图片下标
 */
const handleImageClick = (index: number) => {
  const img = props.images[index]
  imagePreviewUrl.value = `data:image/jpeg;base64,${img}`
  imagePreviewVisible.value = true
}
</script>

<template>
  <el-form-item label="题目原始图片" class="original-image-form-item">
    <div class="original-image-section">
      <div v-if="images.length > 0" class="original-image-list">
        <div v-for="(img, index) in images" :key="index" class="original-image-item">
          <img
            :src="`data:image/jpeg;base64,${img}`"
            alt="题目原始图片"
            @click="handleImageClick(index)"
          />
          <div class="original-image-actions">
            <el-button size="small" circle type="danger" @click.stop="handleRemoveImage(index)">
              <template #icon><font-awesome-icon :icon="['fas', 'trash']" /></template>
            </el-button>
          </div>
        </div>
      </div>
      <div v-else class="original-image-add" @click="handleAddImage">
        <font-awesome-icon :icon="['fas', 'plus']" />
        <span>添加题目原始图片</span>
      </div>
    </div>

    <image-cropper
      v-model:visible="cropperVisible"
      :image-src="cropperImageSrc"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />

    <el-image-viewer
      v-if="imagePreviewVisible"
      :url-list="[imagePreviewUrl]"
      @close="imagePreviewVisible = false"
    >
      <template #footer>
        <el-button
          circle
          type="danger"
          @click="(handleRemoveImage(0), (imagePreviewVisible = false))"
        >
          <template #icon><font-awesome-icon :icon="['fas', 'trash']" /></template>
        </el-button>
      </template>
    </el-image-viewer>
  </el-form-item>
</template>

<style scoped lang="scss">
.original-image-form-item {
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;

  :deep(.el-form-item__label) {
    font-weight: 600;
    color: #303133;
    display: flex;
    align-items: center;
    height: 32px;
  }
}

.original-image-section {
  width: 100%;
}

.original-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.original-image-item {
  position: relative;
  display: inline-block;

  img {
    max-width: 300px;
    max-height: 200px;
    border-radius: 8px;
    border: 1px solid #dcdfe6;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.02);
    }
  }

  .original-image-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .original-image-actions {
    opacity: 1;
  }
}

.original-image-add {
  width: 150px;
  height: 100px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
    color: #409eff;
    background: #f5f7fa;
  }

  span {
    font-size: 13px;
  }
}
</style>
