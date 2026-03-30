<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog, ElButton, ElLoading, ElMessage } from 'element-plus'
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'

interface Props {
  visible: boolean
  imageSrc: string
}

interface Emits {
  (e: 'confirm', croppedBase64: string): void
  (e: 'cancel'): void
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const loading = ref(false)
const cropperRef = ref<InstanceType<typeof VueCropper> | null>(null)

watch(
  () => props.imageSrc,
  () => {
    if (cropperRef.value) {
      cropperRef.value.refresh()
    }
  }
)

const handleOperation = (method: string, ...args: any[]) => {
  if (cropperRef.value && typeof (cropperRef.value as any)[method] === 'function') {
    ;(cropperRef.value as any)[method](...args)
  }
}

const handleZoomIn = () => handleOperation('changeScale', 0.1)
const handleZoomOut = () => handleOperation('changeScale', -0.1)
const handleRotateLeft = () => handleOperation('rotateLeft')
const handleRotateRight = () => handleOperation('rotateRight')
const handleFlipHorizontal = () => handleOperation('flipX')
const handleFlipVertical = () => handleOperation('flipY')
const handleReset = () => handleOperation('recycle')

const handleConfirm = async () => {
  if (!cropperRef.value) return

  loading.value = true
  let fullscreenLoading: any = null

  try {
    fullscreenLoading = ElLoading.service({
      lock: true,
      text: '正在裁剪图片...',
      background: 'rgba(255, 255, 255, 0.8)'
    })

    cropperRef.value.getCropData((data: string) => {
      const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
      emit('confirm', base64Data)
      emit('update:visible', false)
    })
  } catch (error) {
    console.error('裁剪失败:', error)
    ElMessage.error('裁剪失败，请重试')
  } finally {
    loading.value = false
    fullscreenLoading?.close()
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="裁剪图片"
    width="850px"
    :height="'520px'"
    body-class="cropper-dialog-body"
    :close-on-click-modal="false"
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <div class="cropper-wrapper">
      <VueCropper
        ref="cropperRef"
        :img="imageSrc"
        :outputSize="1"
        outputType="jpeg"
        :autoCrop="true"
        :autoCropWidth="640"
        :autoCropHeight="400"
        :fixedBox="false"
        :canMove="true"
        :canMoveBox="true"
        :canScale="true"
        :centerBox="true"
        :info="true"
        :infoTrue="true"
        :mode="'contain'"
      />
    </div>
    <template #footer>
      <div class="toolbar">
        <div class="toolbar-group">
          <el-tooltip content="放大" placement="top">
            <el-button circle @click="handleZoomIn">
              <template #icon
                ><font-awesome-icon :icon="['fas', 'magnifying-glass-plus']"
              /></template>
            </el-button>
          </el-tooltip>
          <el-tooltip content="缩小" placement="top">
            <el-button circle @click="handleZoomOut">
              <template #icon
                ><font-awesome-icon :icon="['fas', 'magnifying-glass-minus']"
              /></template>
            </el-button>
          </el-tooltip>
        </div>
        <el-divider direction="vertical" />
        <div class="toolbar-group">
          <el-tooltip content="左旋转" placement="top">
            <el-button circle @click="handleRotateLeft">
              <template #icon><font-awesome-icon :icon="['fas', 'rotate-left']" /></template>
            </el-button>
          </el-tooltip>
          <el-tooltip content="右旋转" placement="top">
            <el-button circle @click="handleRotateRight">
              <template #icon><font-awesome-icon :icon="['fas', 'rotate-right']" /></template>
            </el-button>
          </el-tooltip>
        </div>
        <el-divider direction="vertical" />
        <div class="toolbar-group">
          <el-tooltip content="水平翻转" placement="top">
            <el-button circle @click="handleFlipHorizontal">
              <template #icon><font-awesome-icon :icon="['fas', 'left-right']" /></template>
            </el-button>
          </el-tooltip>
          <el-tooltip content="垂直翻转" placement="top">
            <el-button circle @click="handleFlipVertical">
              <template #icon><font-awesome-icon :icon="['fas', 'up-down']" /></template>
            </el-button>
          </el-tooltip>
        </div>
        <el-divider direction="vertical" />
        <el-tooltip content="重置" placement="top">
          <el-button circle @click="handleReset">
            <template #icon><font-awesome-icon :icon="['fas', 'arrow-rotate-right']" /></template>
          </el-button>
        </el-tooltip>
        <div class="toolbar-spacer" />
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleConfirm">确定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.cropper-wrapper {
  width: 100%;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  overflow: hidden;
}

:deep(.cropper-dialog-body) {
  padding: 0;
  height: 520px;
  display: flex;
  flex-direction: column;
}

:deep(.vue-cropper) {
  width: 100%;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-spacer {
  flex: 1;
}

:deep(.el-divider--vertical) {
  height: 24px;
  margin: 0 8px;
}

:deep(.el-button.is-circle) {
  width: 36px;
  height: 36px;
  padding: 0;
}
</style>
