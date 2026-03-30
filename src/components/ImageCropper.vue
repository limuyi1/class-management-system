<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { ElDialog, ElButton } from 'element-plus'
import 'cropperjs'

interface Props {
  visible: boolean
  imageSrc: string
}

interface Emits {
  (e: 'confirm', croppedBase64: string): void
  (e: 'cancel'): void
  (e: 'update:visible', value: boolean): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const containerRef = ref<HTMLElement>()
const canvasRef = ref<any>(null)

onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.innerHTML = ''
  }
})

const handleOperation = (method: string, ...args: any[]) => {
  const canvas = containerRef.value?.querySelector('cropper-canvas')
  const image = canvas?.querySelector('cropper-image') as any
  if (image && typeof (image as any)[method] === 'function') {
    ;(image as any)[method](...args)
  }
}

const handleZoomIn = () => handleOperation('$zoom', 0.1)
const handleZoomOut = () => handleOperation('$zoom', -0.1)
const handleRotateLeft = () => handleOperation('$rotate', '-90deg')
const handleRotateRight = () => handleOperation('$rotate', '90deg')
const handleFlipHorizontal = () => handleOperation('$scale', -1, 1)
const handleFlipVertical = () => handleOperation('$scale', 1, -1)
const handleReset = () => handleOperation('$resetTransform')

const handleConfirm = async () => {
  const canvas = containerRef.value?.querySelector('cropper-canvas') as any
  if (!canvas) return

  try {
    const htmlCanvas = await canvas.$toCanvas({
      width: 1024,
      height: 1024
    })

    const croppedBase64 = htmlCanvas
      .toDataURL('image/jpeg', 0.7)
      .replace(/^data:image\/\w+;base64,/, '')
    emit('confirm', croppedBase64)
    emit('update:visible', false)
  } catch (error) {
    console.error('裁剪失败:', error)
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
    <div ref="containerRef" class="cropper-wrapper">
      <cropper-canvas ref="canvasRef" background viewBox="0 0 800 460">
        <cropper-image :src="imageSrc" alt="裁剪图片" translatable rotatable scalable skewable />
        <cropper-shade hidden />
        <cropper-handle action="select" plain />
        <cropper-selection initial-coverage="0.85" movable resizable>
          <cropper-grid role="grid" covered />
          <cropper-crosshair centered />
          <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)" />
          <cropper-handle action="n-resize" />
          <cropper-handle action="e-resize" />
          <cropper-handle action="s-resize" />
          <cropper-handle action="w-resize" />
          <cropper-handle action="ne-resize" />
          <cropper-handle action="nw-resize" />
          <cropper-handle action="se-resize" />
          <cropper-handle action="sw-resize" />
        </cropper-selection>
      </cropper-canvas>
    </div>
    <template #footer>
      <div class="toolbar">
        <div class="toolbar-group">
          <el-tooltip content="放大" placement="top">
            <el-button circle @click="handleZoomIn">
              <font-awesome-icon :icon="['fas', 'magnifying-glass-plus']" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="缩小" placement="top">
            <el-button circle @click="handleZoomOut">
              <font-awesome-icon :icon="['fas', 'magnifying-glass-minus']" />
            </el-button>
          </el-tooltip>
        </div>
        <el-divider direction="vertical" />
        <div class="toolbar-group">
          <el-tooltip content="左旋转" placement="top">
            <el-button circle @click="handleRotateLeft">
              <font-awesome-icon :icon="['fas', 'rotate-left']" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="右旋转" placement="top">
            <el-button circle @click="handleRotateRight">
              <font-awesome-icon :icon="['fas', 'rotate-right']" />
            </el-button>
          </el-tooltip>
        </div>
        <el-divider direction="vertical" />
        <div class="toolbar-group">
          <el-tooltip content="水平翻转" placement="top">
            <el-button circle @click="handleFlipHorizontal">
              <font-awesome-icon :icon="['fas', 'left-right']" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="垂直翻转" placement="top">
            <el-button circle @click="handleFlipVertical">
              <font-awesome-icon :icon="['fas', 'up-down']" />
            </el-button>
          </el-tooltip>
        </div>
        <el-divider direction="vertical" />
        <el-tooltip content="重置" placement="top">
          <el-button circle @click="handleReset">
            <font-awesome-icon :icon="['fas', 'arrow-rotate-right']" />
          </el-button>
        </el-tooltip>
        <div class="toolbar-spacer" />
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleConfirm">确定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.cropper-wrapper {
  width: 100%;
  height: 100%;
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

:deep(cropper-canvas) {
  width: 100%;
  height: 100%;
  min-height: 460px;
}

:deep(cropper-image) {
  max-width: 100%;
  max-height: 100%;
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
