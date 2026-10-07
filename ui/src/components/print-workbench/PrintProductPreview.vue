<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import PrintPreviewViewport from './PrintPreviewViewport.vue'

const props = withDefaults(
  defineProps<{
    width: number
    version: string
    createImage: () => Promise<Blob>
    imageScale?: number
  }>(),
  { imageScale: 1 }
)
const visible = defineModel<boolean>({ required: true })
const imageUrl = ref('')
const imageVersion = ref('')
const viewingImage = ref(false)
const generating = ref(false)
const resolution = ref('')
const generatedScale = ref(1)
const generatedAt = ref('')
let disposed = false
/** 图片仅由按钮触发，编辑后标记旧版本，不自动截图。 */
async function generate(): Promise<void> {
  if (generating.value) return
  generating.value = true
  const version = props.version
  const scale = props.imageScale
  try {
    const blob = await props.createImage()
    if (disposed) return
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
    if (disposed) {
      URL.revokeObjectURL(url)
      return
    }
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = url
    imageVersion.value = version
    generatedScale.value = scale
    generatedAt.value = new Date().toLocaleTimeString()
    resolution.value = `${image.naturalWidth} × ${image.naturalHeight} 像素`
    viewingImage.value = true
  } catch (error) {
    console.error(error)
    ElMessage.error('图片生成失败，请检查素材后重试')
  } finally {
    generating.value = false
  }
}
watch(visible, (value) => {
  if (value) viewingImage.value = false
})
onBeforeUnmount(() => {
  disposed = true
  URL.revokeObjectURL(imageUrl.value)
})
</script>
<template>
  <el-dialog
    v-model="visible"
    title="成品预览"
    width="90%"
    top="4vh"
    destroy-on-close
    class="print-product-dialog"
  >
    <div class="print-product__body">
      <div class="print-product__actions">
        <el-button :type="!viewingImage ? 'primary' : 'default'" @click="viewingImage = false"
          >DOM 成品</el-button
        >
        <el-button :loading="generating" @click="generate">{{
          imageUrl ? '重新生成导出图片' : '查看导出图片'
        }}</el-button>
        <span v-if="viewingImage"
          >{{ resolution }} · {{ generatedScale }}× 导出 · {{ generatedAt }}生成 ·
          {{ imageVersion === version ? '当前版本' : '内容已修改，需重新生成' }} · 等比显示</span
        >
      </div>
      <el-scrollbar v-if="viewingImage" class="print-product__image" aria-label="导出图片滚动区域"
        ><img :src="imageUrl" alt="主动生成的导出图片"
      /></el-scrollbar>
      <PrintPreviewViewport v-else :width="width"><slot /></PrintPreviewViewport>
    </div>
  </el-dialog>
</template>
<style scoped lang="scss">
.print-product__body {
  height: 78vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.print-product__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.print-product__stale {
  color: var(--el-color-warning);
}
.print-product__actions :deep(.el-button) {
  margin-left: 0;
}
.print-product__body > .print-preview,
.print-product__image {
  flex: 1;
  min-height: 0;
}
.print-product__image {
  background: var(--el-fill-color-light);
}
.print-product__image img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
</style>
