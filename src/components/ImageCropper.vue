<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElDialog, ElButton, ElMessage } from 'element-plus'
import { runWithLoading } from '@/hooks/useLoading'
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'

import {
  compressDataUrlByRatio,
  dataUrlToBase64,
  estimateCompressedImageSize,
  formatFileSize
} from '@/utils/fileUtil'

/**
 * 图片裁剪弹窗组件。
 *
 * 基于 vue-cropper 提供缩放、旋转、翻转、重置等操作，支持全屏编辑与可选压缩，
 * 确认后以 Base64 形式返回裁剪结果，并将压缩比例同步回父组件。
 */
interface Props {
  /** 弹窗是否可见 */
  visible: boolean
  /** 待裁剪图片地址 */
  imageSrc: string
  /** 输出图片格式 */
  outputType?: 'jpeg' | 'png' | 'webp'
  /** 是否启用压缩选项 */
  enableCompression?: boolean
  /** 压缩比例（null 表示原图） */
  compressRatio?: number | null
}

interface Emits {
  /** 确认裁剪，回传 Base64 结果 */
  (e: 'confirm', croppedBase64: string): void
  /** 取消裁剪 */
  (e: 'cancel'): void
  /** 弹窗可见状态变化 */
  (e: 'update:visible', value: boolean): void
  /** 压缩比例变化 */
  (e: 'update:compressRatio', value: number | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 确认操作进行中标记 */
const loading = ref(false)
/** 是否处于全屏模式 */
const fullscreen = ref(false)
/** 裁剪容器 DOM 引用 */
const cropperWrapperRef = ref<HTMLDivElement | null>(null)
/** 裁剪器组件实例引用 */
const cropperRef = ref<InstanceType<typeof VueCropper> | null>(null)
/** 裁剪器是否已就绪 */
const cropperReady = ref(false)
/** 裁剪框宽度 */
const autoCropWidth = ref(640)
/** 裁剪框高度 */
const autoCropHeight = ref(400)
/** 当前裁剪结果 Base64，用于体积估算 */
const cropDataBase64 = ref('')
/** 体积估算进行中标记 */
const estimating = ref(false)

// 裁剪框相关常量：默认尺寸、宽高比、全屏边距与最小尺寸
const DEFAULT_CROP_WIDTH = 640
const DEFAULT_CROP_HEIGHT = 400
const CROP_BOX_RATIO = DEFAULT_CROP_WIDTH / DEFAULT_CROP_HEIGHT
const FULLSCREEN_CROP_BOX_PADDING = 40
const MIN_CROP_WIDTH = 220
const MIN_CROP_HEIGHT = 140
// 尺寸变化小于该阈值时跳过刷新，避免无谓重绘
const CROP_SIZE_CHANGE_THRESHOLD = 4
// 压缩输出质量与尺寸估算防抖延迟
const COMPRESS_QUALITY = 0.85
const ESTIMATE_DEBOUNCE_DELAY = 350
// 「原图」选项的哨兵值，实际压缩比例用 null 表示
const ORIGINAL_COMPRESS_VALUE = 'original'

/** 压缩选项值：数值比例或「原图」哨兵值 */
type CompressOptionValueType = number | typeof ORIGINAL_COMPRESS_VALUE

interface CompressOptionType {
  /** 选项展示文本 */
  label: string
  /** 选项值 */
  value: CompressOptionValueType
}

/** 压缩比例选项列表 */
const COMPRESS_RATIO_OPTIONS: Array<CompressOptionType> = [
  { label: '原图', value: ORIGINAL_COMPRESS_VALUE },
  { label: '80%', value: 0.8 },
  { label: '60%', value: 0.6 },
  { label: '40%', value: 0.4 },
  { label: '25%', value: 0.25 }
]

/** 容器尺寸监听器 */
let resizeObserver: ResizeObserver | null = null
/** 布局刷新帧 id，用于合并同一帧内的多次刷新请求 */
let refreshFrameId = 0
/** 是否存在待执行的强制刷新 */
let pendingForceRefresh = false
/** 压缩估算防抖定时器 id */
let estimateTimer = 0

/** 裁剪器操作方法名集合 */
type CropperMethodNameType =
  | 'changeScale'
  | 'rotateLeft'
  | 'rotateRight'
  | 'flipX'
  | 'flipY'
  | 'recycle'

/** 裁剪器对外暴露的 API 形状 */
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

// 当前压缩比例：未指定时默认 0.6，并随选择回写父组件
const currentCompressRatio = computed({
  get: () => (props.compressRatio === undefined ? 0.6 : props.compressRatio),
  set: (value: number | null) => emit('update:compressRatio', value)
})

// 下拉选项值：将「原图」映射为哨兵值，其余为压缩比例数值
const selectedCompressOptionValue = computed<CompressOptionValueType>({
  get: () => currentCompressRatio.value ?? ORIGINAL_COMPRESS_VALUE,
  set: (value) => {
    currentCompressRatio.value = value === ORIGINAL_COMPRESS_VALUE ? null : value
  }
})

/**
 * 将下拉选项值转换为实际压缩比例
 * @param value - 选项值
 * @returns 压缩比例，「原图」返回 null
 */
const getCompressRatioValue = (value: CompressOptionValueType): number | null => {
  return value === ORIGINAL_COMPRESS_VALUE ? null : value
}

/**
 * 根据当前模式计算裁剪框尺寸，仅在尺寸发生有效变化时更新并返回是否需要刷新
 * @returns 是否发生了有意义的尺寸变化
 */
const updateCropBoxSize = (): boolean => {
  if (!fullscreen.value) {
    // 非全屏模式统一恢复为默认尺寸
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
  // 在容器内边距范围内计算可用宽高，并保底最小尺寸
  const maxWidth = Math.max(wrapper.clientWidth - padding * 2, MIN_CROP_WIDTH)
  const maxHeight = Math.max(wrapper.clientHeight - padding * 2, MIN_CROP_HEIGHT)

  let nextWidth = maxWidth
  let nextHeight = Math.round(nextWidth / CROP_BOX_RATIO)

  // 高度超限时反向收缩宽度，保证裁剪框保持默认宽高比
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

/**
 * 刷新裁剪器布局，尺寸有变化或强制刷新时调用底层 refresh
 * @param forceRefresh - 是否强制刷新
 */
const refreshCropperLayout = (forceRefresh = false) => {
  const sizeChanged = updateCropBoxSize()

  const cropper = cropperRef.value as unknown as CropperApiType | null
  if (forceRefresh || sizeChanged) {
    cropper?.refresh()
  }
}

/** 取消尚未执行的布局刷新任务 */
const cancelScheduledRefresh = () => {
  if (refreshFrameId) {
    cancelAnimationFrame(refreshFrameId)
    refreshFrameId = 0
  }
  pendingForceRefresh = false
}

/** 取消尚未执行的压缩估算任务 */
const cancelScheduledEstimate = () => {
  if (estimateTimer) {
    window.clearTimeout(estimateTimer)
    estimateTimer = 0
  }
}

/** 立即获取当前裁剪结果用于体积估算 */
const updateCropEstimate = () => {
  if (!props.enableCompression) return

  const cropper = cropperRef.value as unknown as CropperApiType | null
  if (!cropper) return

  estimating.value = true
  cropper.getCropData((data: string) => {
    cropDataBase64.value = dataUrlToBase64(data)
    estimating.value = false
  })
}

/** 防抖调度压缩体积估算，避免裁剪过程中频繁计算 */
const scheduleCropEstimate = () => {
  if (!props.enableCompression) return

  cancelScheduledEstimate()
  estimateTimer = window.setTimeout(() => {
    estimateTimer = 0
    updateCropEstimate()
  }, ESTIMATE_DEBOUNCE_DELAY)
}

/**
 * 调度布局刷新；同一帧内多次请求会被合并，避免重复刷新
 * @param forceRefresh - 是否强制刷新
 */
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

/** 停止并清理容器尺寸监听 */
const stopResizeObserver = () => {
  resizeObserver?.disconnect()
  resizeObserver = null
}

/** 开始监听容器尺寸变化 */
const startResizeObserver = () => {
  const wrapper = cropperWrapperRef.value
  if (!wrapper || typeof ResizeObserver === 'undefined') return

  stopResizeObserver()
  resizeObserver = new ResizeObserver(() => {
    scheduleRefreshCropperLayout()
  })
  resizeObserver.observe(wrapper)
}

/** 初始化裁剪器：等待挂载后计算尺寸，再开启监听与估算 */
const prepareCropper = async () => {
  await nextTick()
  updateCropBoxSize()
  cropperReady.value = true
  await nextTick()
  startResizeObserver()
  scheduleCropEstimate()
}

// 图片源变化且弹窗可见时重建裁剪器
watch(
  () => props.imageSrc,
  () => {
    if (!props.visible) return
    // 图片源变化时重建裁剪器
    cropperReady.value = false
    void prepareCropper()
  }
)

// 弹窗关闭时重置状态并清理定时器与监听
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      // 关闭时重置状态并清理定时器与监听，防止残留副作用
      cropperReady.value = false
      fullscreen.value = false
      cropDataBase64.value = ''
      stopResizeObserver()
      cancelScheduledRefresh()
      cancelScheduledEstimate()
    }
  }
)

/**
 * 调用裁剪器的单个操作
 * @param method - 操作方法名
 * @param args - 操作参数（仅缩放操作会使用）
 */
const handleOperation = (method: CropperMethodNameType, ...args: number[]) => {
  const cropper = cropperRef.value as unknown as CropperApiType | null
  if (!cropper) return

  if (method === 'changeScale') {
    cropper.changeScale(args[0] || 0)
    return
  }

  cropper[method]()
}

/** 放大裁剪框 */
const handleZoomIn = () => handleOperation('changeScale', 0.1)
/** 缩小裁剪框 */
const handleZoomOut = () => handleOperation('changeScale', -0.1)
/** 向左旋转 */
const handleRotateLeft = () => handleOperation('rotateLeft')
/** 向右旋转 */
const handleRotateRight = () => handleOperation('rotateRight')
/** 水平翻转 */
const handleFlipHorizontal = () => handleOperation('flipX')
/** 垂直翻转 */
const handleFlipVertical = () => handleOperation('flipY')
/** 重置裁剪框 */
const handleReset = () => handleOperation('recycle')

// 裁剪实时变化时触发估算调度（内部有防抖）
const handleRealtime = () => {
  scheduleCropEstimate()
}

/**
 * 计算压缩选项展示文案，含估算中的提示与预估体积
 * @param option - 压缩选项
 * @returns 展示文案
 */
const getCompressOptionLabel = (option: CompressOptionType): string => {
  if (!cropDataBase64.value) return option.label
  // 正在估算且恰好是当前选项时给出「估算中」提示
  if (estimating.value && option.value === selectedCompressOptionValue.value) {
    return `${option.label} · 估算中`
  }

  const size = estimateCompressedImageSize(cropDataBase64.value, getCompressRatioValue(option.value))
  return `${option.label} · 约${formatFileSize(size)}`
}

/** 切换全屏模式并重建裁剪器布局 */
const toggleFullscreen = () => {
  cropperReady.value = false
  stopResizeObserver()
  cancelScheduledRefresh()
  fullscreen.value = !fullscreen.value
  void prepareCropper()
}

/**
 * 确认裁剪：按需压缩后关闭弹窗并回传 Base64 结果
 */
const handleConfirm = async () => {
  if (!cropperRef.value) return

  loading.value = true

  try {
    const confirmedBase64 = await runWithLoading(
      props.enableCompression ? '正在裁剪并压缩图片...' : '正在裁剪图片...',
      async () => {
        const cropper = cropperRef.value as unknown as CropperApiType
        const croppedDataUrl = await new Promise<string>((resolve) => {
          cropper.getCropData((data: string) => resolve(data))
        })
        // 开启压缩时按比例压缩，否则仅转换为 Base64
        if (props.enableCompression) {
          const compressed = await compressDataUrlByRatio(
            croppedDataUrl,
            currentCompressRatio.value,
            COMPRESS_QUALITY
          )
          return compressed.base64
        }
        return dataUrlToBase64(croppedDataUrl)
      },
      'rgba(255, 255, 255, 0.8)'
    )

    loading.value = false
    emit('update:visible', false)
    emit('confirm', confirmedBase64)
  } catch (error) {
    console.error('裁剪失败:', error)
    ElMessage.error('裁剪失败，请重试')
  } finally {
    loading.value = false
  }
}

/** 取消裁剪并关闭弹窗 */
const handleCancel = () => {
  emit('cancel')
  emit('update:visible', false)
}

/** 弹窗打开动画结束后初始化裁剪器 */
const handleOpened = () => {
  void prepareCropper()
}

// 卸载前清理监听与定时任务，避免内存泄漏
onBeforeUnmount(() => {
  stopResizeObserver()
  cancelScheduledRefresh()
  cancelScheduledEstimate()
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
    <!-- 裁剪容器，就绪后渲染裁剪器 -->
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
        @realTime="handleRealtime"
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
        <el-divider v-if="enableCompression" direction="vertical" />
        <div v-if="enableCompression" class="compression-control">
          <span class="compression-label">压缩</span>
          <el-select
            v-model="selectedCompressOptionValue"
            class="compression-select"
            size="small"
            :teleported="false"
          >
            <el-option
              v-for="option in COMPRESS_RATIO_OPTIONS"
              :key="String(option.value)"
              :label="getCompressOptionLabel(option)"
              :value="option.value"
            />
          </el-select>
        </div>
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
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-spacer {
  flex: 1;
}

.compression-control {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 150px;
}

.compression-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.compression-select {
  width: 128px;
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
