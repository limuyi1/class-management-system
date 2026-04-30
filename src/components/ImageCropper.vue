<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElDialog, ElButton, ElLoading, ElMessage } from 'element-plus'
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'

interface Props {
  visible: boolean
  imageSrc: string
  outputType?: 'jpeg' | 'png' | 'webp'
}

interface Emits {
  (e: 'confirm', croppedBase64: string): void
  (e: 'cancel'): void
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const loading = ref(false)
const fullscreen = ref(false)
const cropperWrapperRef = ref<HTMLDivElement | null>(null)
const cropperRef = ref<InstanceType<typeof VueCropper> | null>(null)
const cropperReady = ref(false)
const autoCropWidth = ref(640)
const autoCropHeight = ref(400)

const DEFAULT_CROP_WIDTH = 640
const DEFAULT_CROP_HEIGHT = 400
const CROP_BOX_RATIO = DEFAULT_CROP_WIDTH / DEFAULT_CROP_HEIGHT
const FULLSCREEN_CROP_BOX_PADDING = 40
const MIN_CROP_WIDTH = 220
const MIN_CROP_HEIGHT = 140
const CROP_SIZE_CHANGE_THRESHOLD = 4

let resizeObserver: ResizeObserver | null = null
let refreshFrameId = 0
let pendingForceRefresh = false

type CropperMethodNameType =
  | 'changeScale'
  | 'rotateLeft'
  | 'rotateRight'
  | 'flipX'
  | 'flipY'
  | 'recycle'

interface CropperApiType {
  refresh: () => void
  getCropData: (callback: (data: string) => void) => void
  changeScale: (scale: number) => void
  rotateLeft: () => void
  rotateRight: () => void
  flipX: () => void
  flipY: () => void
  recycle: () => void
}

const updateCropBoxSize = (): boolean => {
  if (!fullscreen.value) {
    const hasMeaningfulChange =
      Math.abs(DEFAULT_CROP_WIDTH - autoCropWidth.value) > CROP_SIZE_CHANGE_THRESHOLD ||
      Math.abs(DEFAULT_CROP_HEIGHT - autoCropHeight.value) > CROP_SIZE_CHANGE_THRESHOLD

    if (hasMeaningfulChange) {
      autoCropWidth.value = DEFAULT_CROP_WIDTH
      autoCropHeight.value = DEFAULT_CROP_HEIGHT
    }

    return hasMeaningfulChange
  }

  const wrapper = cropperWrapperRef.value
  if (!wrapper) return false
  const padding = FULLSCREEN_CROP_BOX_PADDING
  const maxWidth = Math.max(wrapper.clientWidth - padding * 2, MIN_CROP_WIDTH)
  const maxHeight = Math.max(wrapper.clientHeight - padding * 2, MIN_CROP_HEIGHT)

  let nextWidth = maxWidth
  let nextHeight = Math.round(nextWidth / CROP_BOX_RATIO)

  if (nextHeight > maxHeight) {
    nextHeight = maxHeight
    nextWidth = Math.round(nextHeight * CROP_BOX_RATIO)
  }

  const nextAutoCropWidth = Math.max(Math.floor(nextWidth), MIN_CROP_WIDTH)
  const nextAutoCropHeight = Math.max(Math.floor(nextHeight), MIN_CROP_HEIGHT)
  const hasMeaningfulChange =
    Math.abs(nextAutoCropWidth - autoCropWidth.value) > CROP_SIZE_CHANGE_THRESHOLD ||
    Math.abs(nextAutoCropHeight - autoCropHeight.value) > CROP_SIZE_CHANGE_THRESHOLD

  if (hasMeaningfulChange) {
    autoCropWidth.value = nextAutoCropWidth
    autoCropHeight.value = nextAutoCropHeight
  }

  return hasMeaningfulChange
}

const refreshCropperLayout = (forceRefresh = false) => {
  const sizeChanged = updateCropBoxSize()

  const cropper = cropperRef.value as unknown as CropperApiType | null
  if (forceRefresh || sizeChanged) {
    cropper?.refresh()
  }
}

const cancelScheduledRefresh = () => {
  if (refreshFrameId) {
    cancelAnimationFrame(refreshFrameId)
    refreshFrameId = 0
  }
  pendingForceRefresh = false
}

const scheduleRefreshCropperLayout = (forceRefresh = false) => {
  pendingForceRefresh = pendingForceRefresh || forceRefresh
  if (refreshFrameId) return

  refreshFrameId = requestAnimationFrame(() => {
    refreshFrameId = 0
    const shouldForceRefresh = pendingForceRefresh
    pendingForceRefresh = false
    refreshCropperLayout(shouldForceRefresh)
  })
}

const stopResizeObserver = () => {
  resizeObserver?.disconnect()
  resizeObserver = null
}

const startResizeObserver = () => {
  const wrapper = cropperWrapperRef.value
  if (!wrapper || typeof ResizeObserver === 'undefined') return

  stopResizeObserver()
  resizeObserver = new ResizeObserver(() => {
    scheduleRefreshCropperLayout()
  })
  resizeObserver.observe(wrapper)
}

const prepareCropper = async () => {
  await nextTick()
  updateCropBoxSize()
  cropperReady.value = true
  await nextTick()
  startResizeObserver()
}

watch(
  () => props.imageSrc,
  () => {
    if (!props.visible) return
    cropperReady.value = false
    void prepareCropper()
  }
)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      cropperReady.value = false
      fullscreen.value = false
      stopResizeObserver()
      cancelScheduledRefresh()
    }
  }
)

const handleOperation = (method: CropperMethodNameType, ...args: number[]) => {
  const cropper = cropperRef.value as unknown as CropperApiType | null
  if (!cropper) return

  if (method === 'changeScale') {
    cropper.changeScale(args[0] || 0)
    return
  }

  cropper[method]()
}

const handleZoomIn = () => handleOperation('changeScale', 0.1)
const handleZoomOut = () => handleOperation('changeScale', -0.1)
const handleRotateLeft = () => handleOperation('rotateLeft')
const handleRotateRight = () => handleOperation('rotateRight')
const handleFlipHorizontal = () => handleOperation('flipX')
const handleFlipVertical = () => handleOperation('flipY')
const handleReset = () => handleOperation('recycle')

const toggleFullscreen = () => {
  cropperReady.value = false
  stopResizeObserver()
  cancelScheduledRefresh()
  fullscreen.value = !fullscreen.value
  void prepareCropper()
}

const handleConfirm = async () => {
  if (!cropperRef.value) return

  loading.value = true
  let fullscreenLoading: ReturnType<typeof ElLoading.service> | null = null

  try {
    fullscreenLoading = ElLoading.service({
      lock: true,
      text: '正在裁剪图片...',
      background: 'rgba(255, 255, 255, 0.8)'
    })

    const cropper = cropperRef.value as unknown as CropperApiType
    cropper.getCropData((data: string) => {
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

const handleOpened = () => {
  void prepareCropper()
}

onBeforeUnmount(() => {
  stopResizeObserver()
  cancelScheduledRefresh()
})
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="裁剪图片"
    class="cropper-dialog"
    :fullscreen="fullscreen"
    :width="fullscreen ? undefined : '850px'"
    body-class="cropper-dialog-body"
    footer-class="cropper-dialog-footer"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
    @opened="handleOpened"
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <div ref="cropperWrapperRef" class="cropper-wrapper" :class="{ fullscreen }">
      <VueCropper
        v-if="cropperReady"
        ref="cropperRef"
        :img="imageSrc"
        :outputSize="1"
        :outputType="props.outputType || 'jpeg'"
        :autoCrop="true"
        :autoCropWidth="autoCropWidth"
        :autoCropHeight="autoCropHeight"
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
          <el-tooltip :content="fullscreen ? '退出全屏' : '放大全屏'" placement="top">
            <el-button circle @click="toggleFullscreen">
              <template #icon>
                <font-awesome-icon
                  :icon="[
                    'fas',
                    fullscreen
                      ? 'down-left-and-up-right-to-center'
                      : 'up-right-and-down-left-from-center'
                  ]"
                />
              </template>
            </el-button>
          </el-tooltip>
          <el-divider direction="vertical" />
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
  height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  overflow: hidden;
}

.cropper-wrapper.fullscreen {
  height: 100%;
  min-height: 0;
}

:deep(.vue-cropper) {
  width: 100%;
  height: 100%;
  display: block;
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

<style lang="scss">
.cropper-dialog.el-dialog {
  width: 850px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;

  > .el-dialog__body {
    padding: 0;
  }

  .cropper-wrapper {
    width: 100%;
    height: 420px;
  }
}

.cropper-dialog.el-dialog.is-fullscreen {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  max-height: 100vh;
  margin: 0;
  overflow: hidden;
  box-sizing: border-box;

  > .el-dialog__header,
  > .cropper-dialog-footer {
    min-height: 0;
  }

  > .cropper-dialog-body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .cropper-wrapper {
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
  }
}
</style>
