<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'

import AttachmentSelectorDialog from '@/views/tools/components/AttachmentSelectorDialog.vue'
import PaperLayoutDraftDialog from '@/views/tools/components/PaperLayoutDraftDialog.vue'
import {
  getPaperLayoutPreset,
  normalizePaperLayoutSettings
} from '@/views/tools/constants/paperLayout'
import { PagesEnum } from '@/types/Common'
import { useToolsStore } from '@/stores/tools'
import { mmToPixelPrecise } from '@/utils/pageSizeInPixelUntil'
import { attachmentToObjectUrl, getAttachments } from '@/views/tools/services/attachmentService'
import { exportPaperLayoutPdf } from '@/views/tools/services/paperLayoutExportService'
import {
  getPaperLayoutDrafts,
  savePaperLayoutDraft
} from '@/views/tools/services/paperLayoutDraftService'
import {
  arrangePaperItems,
  buildPaperLayoutPages,
  clampPaperItemPosition,
  createPaperLayoutItem,
  getPaperLayoutPageSize
} from '@/views/tools/utils/paperLayoutCanvas'
import type {
  AttachmentRecordType,
  PaperLayoutCanvasItemType,
  PaperLayoutDraftRecordType,
  PaperLayoutDragStateType
} from '@/types/Tools'

interface Props {
  fullscreen?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  toggleFullscreen: []
}>()

const minVisibleMm = 8
const minItemWidthMm = 18
const previewPanelRef = ref<HTMLElement | null>(null)
const canvasItems = ref<PaperLayoutCanvasItemType[]>([])
const selectedItemId = ref('')
const exporting = ref(false)
const previewScale = ref(1)
const selectorVisible = ref(false)
const draftDialogVisible = ref(false)
const attachmentCount = ref(0)
const draftCount = ref(0)
const activePageNumber = ref(1)
const dragState = ref<PaperLayoutDragStateType | null>(null)
const currentDraftId = ref('')
const currentDraftName = ref('')

const router = useRouter()
const toolsStore = useToolsStore()
const settings = toolsStore.paperLayout

const pageSize = computed(() => getPaperLayoutPageSize(settings))
const layoutPreset = computed(() => getPaperLayoutPreset(settings.orientation))
const contentWidth = computed(() => pageSize.value.width - layoutPreset.value.margin * 2)
const contentHeight = computed(() => pageSize.value.height - layoutPreset.value.margin * 2)
const columnWidth = computed(() => {
  return (
    (contentWidth.value - layoutPreset.value.gap * (layoutPreset.value.columns - 1)) /
    layoutPreset.value.columns
  )
})

const layoutMetrics = computed(() => ({
  pageSize: pageSize.value,
  margin: layoutPreset.value.margin,
  gap: layoutPreset.value.gap,
  columns: layoutPreset.value.columns,
  columnWidth: columnWidth.value,
  contentHeight: contentHeight.value
}))

const pages = computed(() => buildPaperLayoutPages(canvasItems.value))
const pageCount = computed(() => pages.value.length)

const selectedItem = computed(() => {
  return canvasItems.value.find((item) => item.id === selectedItemId.value)
})

const activePageIndex = computed(() => selectedItem.value?.pageIndex ?? activePageNumber.value - 1)

const pageStyle = computed(() => ({
  width: `${mmToPixelPrecise(pageSize.value.width)}px`,
  height: `${mmToPixelPrecise(pageSize.value.height)}px`,
  '--paper-margin': `${mmToPixelPrecise(layoutPreset.value.margin)}px`
}))

const scaledPageStyle = computed(() => ({
  width: `${mmToPixelPrecise(pageSize.value.width) * previewScale.value}px`,
  height: `${mmToPixelPrecise(pageSize.value.height) * previewScale.value}px`
}))

const previewPercent = computed(() => `${Math.round(previewScale.value * 100)}%`)

const currentImagesHint = computed(() => {
  if (canvasItems.value.length === 0) return '从附件库选择图片后开始排版'
  return `${canvasItems.value.length} 张图片 / ${pageCount.value} 页`
})

onMounted(() => {
  window.addEventListener('resize', fitPreviewWidth)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  fitPreviewWidth()
  refreshAttachmentCount()
  refreshDraftCount()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitPreviewWidth)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  revokeItemUrls()
})

watch(
  () => [pageSize.value.width, pageSize.value.height],
  () => {
    fitPreviewWidth()
  }
)

watch(
  () => settings.orientation,
  (orientation) => {
    Object.assign(settings, getPaperLayoutPreset(orientation))
  },
  { immediate: true }
)

function goAttachmentLibrary(): void {
  router.push('/tools/attachments')
}

async function refreshAttachmentCount(): Promise<void> {
  attachmentCount.value = (await getAttachments()).length
}

async function refreshDraftCount(): Promise<void> {
  draftCount.value = (await getPaperLayoutDrafts()).length
}

async function openAttachmentSelector(): Promise<void> {
  await refreshAttachmentCount()
  if (attachmentCount.value === 0) {
    goAttachmentLibrary()
    return
  }
  selectorVisible.value = true
}

function toCanvasItem(attachment: AttachmentRecordType, index: number): PaperLayoutCanvasItemType {
  return createPaperLayoutItem(attachment, {
    index,
    dataUrl: attachmentToObjectUrl(attachment),
    margin: layoutPreset.value.margin,
    columnWidth: columnWidth.value
  })
}

/**
 * 画布图片使用 object URL 预览。清空、删除、打开新草稿和组件卸载时必须释放，
 * 否则长时间排版大量图片会持续占用浏览器内存。
 */
function revokeItemUrls(): void {
  canvasItems.value.forEach((item) => {
    URL.revokeObjectURL(item.dataUrl)
  })
}

function handleSelectAttachments(attachments: AttachmentRecordType[]): void {
  if (attachments.length > 0 && canvasItems.value.length === 0) {
    currentDraftId.value = ''
    currentDraftName.value = ''
  }

  const nextItems = attachments.map((attachment, index) =>
    toCanvasItem(attachment, canvasItems.value.length + index)
  )
  canvasItems.value = [...canvasItems.value, ...nextItems]
  autoArrange()
}

function autoArrange(): void {
  canvasItems.value = arrangePaperItems(canvasItems.value, layoutMetrics.value)
}

function selectItem(id: string): void {
  selectedItemId.value = id
}

function handleToolClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('.paper-image-frame')) return
  if (target?.closest('.selected-item-action')) return
  selectedItemId.value = ''
}

function startMove(event: PointerEvent, item: PaperLayoutCanvasItemType): void {
  selectItem(item.id)
  dragState.value = {
    itemId: item.id,
    mode: 'move',
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: item.x,
    startY: item.y,
    startWidth: item.width,
    startHeight: item.height
  }
}

function startResize(event: PointerEvent, item: PaperLayoutCanvasItemType): void {
  event.stopPropagation()
  selectItem(item.id)
  dragState.value = {
    itemId: item.id,
    mode: 'resize',
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: item.x,
    startY: item.y,
    startWidth: item.width,
    startHeight: item.height
  }
}

function clampItemPosition(
  item: PaperLayoutCanvasItemType,
  x: number,
  y: number
): { x: number; y: number } {
  return clampPaperItemPosition(
    item,
    {
      x,
      y
    },
    {
      pageSize: pageSize.value,
      minVisibleMm
    }
  )
}

function handlePointerMove(event: PointerEvent): void {
  const state = dragState.value
  if (!state) return

  const item = canvasItems.value.find((currentItem) => currentItem.id === state.itemId)
  if (!item) return

  /**
   * 指针事件给的是屏幕像素，画布状态存的是毫米。
   * 先扣掉预览缩放，再按浏览器标准 96dpi 换算成毫米，才能保证不同缩放下拖拽距离一致。
   */
  const deltaX = (event.clientX - state.startClientX) / previewScale.value / (96 / 25.4)
  const deltaY = (event.clientY - state.startClientY) / previewScale.value / (96 / 25.4)

  if (state.mode === 'move') {
    const position = clampItemPosition(item, state.startX + deltaX, state.startY + deltaY)
    item.x = position.x
    item.y = position.y
    return
  }

  const ratio = state.startHeight / state.startWidth
  const width = Math.max(minItemWidthMm, state.startWidth + deltaX)
  item.width = width
  item.height = width * ratio
  const position = clampItemPosition(item, item.x, item.y)
  item.x = position.x
  item.y = position.y
}

function handlePointerUp(): void {
  dragState.value = null
}

function scaleSelectedItem(factor: number): void {
  const item = selectedItem.value
  if (!item) return

  const nextWidth = Math.max(minItemWidthMm, item.width * factor)
  const ratio = item.height / item.width
  item.width = nextWidth
  item.height = nextWidth * ratio
  const position = clampItemPosition(item, item.x, item.y)
  item.x = position.x
  item.y = position.y
}

function removeSelectedItem(): void {
  const item = selectedItem.value
  if (!item) return
  URL.revokeObjectURL(item.dataUrl)
  canvasItems.value = canvasItems.value.filter((currentItem) => currentItem.id !== item.id)
  selectedItemId.value = ''
}

async function clearItems(): Promise<void> {
  if (canvasItems.value.length === 0) return

  try {
    await ElMessageBox.confirm('确认清空当前试卷中的图片？附件库中的图片不会删除。', '清空图片', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })
    revokeItemUrls()
    canvasItems.value = []
    selectedItemId.value = ''
    currentDraftId.value = ''
    currentDraftName.value = ''
  } catch {
    // 用户取消时不需要提示
  }
}

async function handleSaveDraft(): Promise<void> {
  if (canvasItems.value.length === 0) {
    ElMessage.warning('请先加入图片')
    return
  }

  try {
    const result = await ElMessageBox.prompt('请输入草稿名称', '保存草稿', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: currentDraftName.value || `试卷排版_${new Date().toLocaleDateString()}`,
      inputValidator: (value) => value.trim().length > 0,
      inputErrorMessage: '名称不能为空'
    })

    const savedDraft = await savePaperLayoutDraft({
      id: currentDraftId.value || undefined,
      name: result.value.trim(),
      settings: normalizePaperLayoutSettings(settings),
      items: canvasItems.value.map((item, index) => ({
        id: item.id,
        attachmentId: item.attachmentId,
        name: item.name,
        mimeType: item.mimeType,
        blob: item.blob,
        naturalWidth: item.naturalWidth,
        naturalHeight: item.naturalHeight,
        order: index,
        pageIndex: item.pageIndex,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex
      }))
    })
    currentDraftId.value = savedDraft.id
    currentDraftName.value = savedDraft.name
    await refreshDraftCount()
    ElMessage.success('草稿已保存')
  } catch {
    // 用户取消时不提示
  }
}

async function handleOpenDraft(draft: PaperLayoutDraftRecordType): Promise<void> {
  const sortedDraftItems = [...draft.items].sort(
    (first, second) => (first.order || 0) - (second.order || 0)
  )
  const nextItems: PaperLayoutCanvasItemType[] = sortedDraftItems.map((draftItem, index) => {
    const attachment: AttachmentRecordType = {
      id: draftItem.attachmentId,
      name: draftItem.name,
      mimeType: draftItem.mimeType,
      blob: draftItem.blob,
      sortOrder: index,
      width: draftItem.naturalWidth,
      height: draftItem.naturalHeight,
      size: draftItem.blob.size,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt
    }
    const item = toCanvasItem(attachment, index)
    return {
      ...item,
      id: draftItem.id || item.id,
      pageIndex: draftItem.pageIndex ?? 0,
      x: draftItem.x ?? item.x,
      y: draftItem.y ?? item.y,
      width: draftItem.width ?? item.width,
      height: draftItem.height ?? item.height,
      zIndex: draftItem.zIndex ?? index + 1
    }
  })

  // 草稿中的 blob 需要重新生成 object URL；切换前先释放当前画布已有 URL。
  revokeItemUrls()
  canvasItems.value = nextItems
  selectedItemId.value = ''
  currentDraftId.value = draft.id
  currentDraftName.value = draft.name
  Object.assign(settings, normalizePaperLayoutSettings(draft.settings))
  ElMessage.success('草稿已打开')
  await refreshDraftCount()
}

async function exportPdf(): Promise<void> {
  if (canvasItems.value.length === 0) {
    ElMessage.warning('请先从附件库选择试卷图片')
    return
  }

  exporting.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出 PDF...'
  })

  try {
    const blob = await exportPaperLayoutPdf(pages.value, pageSize.value)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `试卷排版_${new Date().toLocaleDateString()}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出 PDF 失败:', error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
    loading.close()
  }
}

function setPreviewScale(scale: number): void {
  previewScale.value = Math.min(Math.max(scale, 0.35), 1.4)
}

function zoomPreview(direction: -1 | 1): void {
  setPreviewScale(previewScale.value + direction * 0.1)
}

function fitPreviewWidth(): void {
  const panelWidth = previewPanelRef.value?.clientWidth || 0
  const pageWidth = mmToPixelPrecise(pageSize.value.width)
  if (!panelWidth || !pageWidth) return

  const availableWidth = Math.max(panelWidth - 32, 120)
  setPreviewScale(availableWidth / pageWidth)
}

function getResizeHandleStyle(item: PaperLayoutCanvasItemType): Record<string, string> {
  const visibleRight = Math.min(item.width, pageSize.value.width - item.x)
  const visibleBottom = Math.min(item.height, pageSize.value.height - item.y)

  return {
    left: `${mmToPixelPrecise(Math.max(0, visibleRight)) - 5}px`,
    top: `${mmToPixelPrecise(Math.max(0, visibleBottom)) - 5}px`
  }
}

function scrollToPage(index: number): void {
  activePageNumber.value = index + 1
  void nextTick(() => {
    document.querySelector(`[data-paper-page="${index}"]`)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth'
    })
  })
}

function handlePreviewScroll(): void {
  const pageElements = Array.from(document.querySelectorAll<HTMLElement>('[data-paper-page]'))
  if (pageElements.length === 0) return

  const nearestPage = pageElements.reduce(
    (nearest, element) => {
      const distance = Math.abs(element.getBoundingClientRect().top - 160)
      return distance < nearest.distance ? { element, distance } : nearest
    },
    { element: pageElements[0], distance: Number.POSITIVE_INFINITY }
  )
  const pageIndex = Number(nearestPage.element.dataset.paperPage || 0)
  activePageNumber.value = pageIndex + 1
}
</script>

<template>
  <div class="paper-layout-tool" @click="handleToolClick">
    <div class="layout-toolbar">
      <el-button type="primary" size="small" @click="openAttachmentSelector">
        <template #icon
          ><font-awesome-icon :icon="['solid', attachmentCount === 0 ? 'plus' : 'folder-open']"
        /></template>
        {{ attachmentCount === 0 ? '去附件库添加' : '选择附件' }}
      </el-button>
      <el-button size="small" :disabled="canvasItems.length === 0" @click="autoArrange">
        <template #icon><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" /></template>
        重新自动排版
      </el-button>

      <el-divider direction="vertical" />

      <el-select v-model="settings.pageType" size="small" class="toolbar-select">
        <el-option label="A4" :value="PagesEnum.A4" />
        <el-option label="A3" :value="PagesEnum.A3" />
        <el-option label="B4" :value="PagesEnum.B4" />
        <el-option label="B3" :value="PagesEnum.B3" />
      </el-select>
      <el-segmented
        v-model="settings.orientation"
        size="small"
        :options="[
          { label: '纵向', value: 'portrait' },
          { label: '横向', value: 'landscape' }
        ]"
      />

      <el-divider direction="vertical" />

      <el-button
        class="selected-item-action"
        size="small"
        :disabled="!selectedItem"
        @click="scaleSelectedItem(0.9)"
      >
        <template #icon><font-awesome-icon :icon="['solid', 'magnifying-glass-minus']" /></template>
      </el-button>
      <el-button
        class="selected-item-action"
        size="small"
        :disabled="!selectedItem"
        @click="scaleSelectedItem(1.1)"
      >
        <template #icon><font-awesome-icon :icon="['solid', 'magnifying-glass-plus']" /></template>
      </el-button>
      <el-button
        class="selected-item-action"
        size="small"
        :disabled="!selectedItem"
        @click="removeSelectedItem"
      >
        <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
      </el-button>

      <div class="toolbar-spacer" />

      <el-button size="small" :disabled="canvasItems.length === 0" @click="clearItems"
        >清空</el-button
      >
      <el-button size="small" :disabled="canvasItems.length === 0" @click="handleSaveDraft">
        <template #icon><font-awesome-icon :icon="['solid', 'floppy-disk']" /></template>
        保存草稿
      </el-button>
      <el-button v-if="draftCount > 0" size="small" @click="draftDialogVisible = true">
        <template #icon><font-awesome-icon :icon="['solid', 'folder-open']" /></template>
        打开草稿
      </el-button>
      <el-button
        type="primary"
        size="small"
        :loading="exporting"
        :disabled="canvasItems.length === 0"
        @click="exportPdf"
      >
        <template #icon><font-awesome-icon :icon="['solid', 'file-pdf']" /></template>
        导出 PDF
      </el-button>
      <el-button size="small" circle @click="emit('toggleFullscreen')">
        <font-awesome-icon
          :icon="[
            'solid',
            fullscreen ? 'down-left-and-up-right-to-center' : 'up-right-and-down-left-from-center'
          ]"
        />
      </el-button>
    </div>

    <div class="layout-workbench">
      <aside class="page-navigator">
        <div class="navigator-title">
          <strong>页面</strong>
          <span>{{ currentImagesHint }}</span>
        </div>
        <div v-if="pages.length === 0" class="navigator-empty">
          <font-awesome-icon :icon="['solid', 'file-circle-plus']" />
          <span>暂无页面</span>
        </div>
        <button
          v-for="page in pages"
          v-else
          :key="page.index"
          class="page-thumb"
          type="button"
          @click="scrollToPage(page.index)"
        >
          <span
            class="page-thumb__paper"
            :style="{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }"
          >
            <span
              v-for="item in page.items"
              :key="item.id"
              class="page-thumb__item"
              :style="{
                left: `${(item.x / pageSize.width) * 100}%`,
                top: `${(item.y / pageSize.height) * 100}%`,
                width: `${(item.width / pageSize.width) * 100}%`,
                height: `${(item.height / pageSize.height) * 100}%`
              }"
            ></span>
          </span>
          <span>第 {{ page.index + 1 }} 页</span>
        </button>
      </aside>

      <main ref="previewPanelRef" class="preview-panel">
        <div class="preview-toolbar">
          <div class="preview-title">
            <strong>自由排版画布</strong>
            <span
              >{{ settings.pageType }}
              {{ settings.orientation === 'portrait' ? '纵向' : '横向' }}</span
            >
          </div>
          <div class="preview-actions">
            <span class="page-count">{{
              pageCount > 0 ? `第 ${activePageIndex + 1} 页` : '暂无页面'
            }}</span>
            <el-button size="small" circle @click="zoomPreview(-1)">
              <font-awesome-icon :icon="['solid', 'magnifying-glass-minus']" />
            </el-button>
            <span class="zoom-label">{{ previewPercent }}</span>
            <el-button size="small" circle @click="zoomPreview(1)">
              <font-awesome-icon :icon="['solid', 'magnifying-glass-plus']" />
            </el-button>
            <el-button size="small" circle @click="fitPreviewWidth">
              <font-awesome-icon :icon="['solid', 'arrows-left-right-to-line']" />
            </el-button>
          </div>
        </div>

        <el-scrollbar
          class="preview-scrollbar"
          @scroll="handlePreviewScroll"
          @pointerdown.self="selectedItemId = ''"
        >
          <div v-if="pages.length === 0" class="preview-empty">
            <font-awesome-icon :icon="['solid', 'file-circle-plus']" />
            <span>使用顶部入口添加图片后生成初始排版</span>
          </div>

          <div v-else class="paper-stack" @pointerdown.self="selectedItemId = ''">
            <div
              v-for="page in pages"
              :key="page.index"
              class="paper-page-wrap"
              :data-paper-page="page.index"
            >
              <div class="paper-page-scale" :style="scaledPageStyle">
                <div
                  class="paper-page"
                  :style="{
                    ...pageStyle,
                    transform: `scale(${previewScale})`
                  }"
                  @pointerdown.self="selectedItemId = ''"
                >
                  <div
                    v-for="item in page.items"
                    :key="item.id"
                    class="paper-image-frame"
                    :class="{ selected: selectedItemId === item.id }"
                    :style="{
                      left: `${mmToPixelPrecise(item.x)}px`,
                      top: `${mmToPixelPrecise(item.y)}px`,
                      width: `${mmToPixelPrecise(item.width)}px`,
                      height: `${mmToPixelPrecise(item.height)}px`,
                      zIndex: item.zIndex
                    }"
                    @pointerdown="startMove($event, item)"
                  >
                    <img
                      class="paper-image"
                      :src="item.dataUrl"
                      :alt="item.name"
                      draggable="false"
                    />
                    <span
                      class="resize-handle"
                      :style="getResizeHandleStyle(item)"
                      @pointerdown="startResize($event, item)"
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </main>
    </div>

    <attachment-selector-dialog
      v-model:visible="selectorVisible"
      @confirm="handleSelectAttachments"
      @add-attachments="goAttachmentLibrary"
    />
    <paper-layout-draft-dialog v-model:visible="draftDialogVisible" @open="handleOpenDraft" />
  </div>
</template>

<style scoped lang="scss">
.paper-layout-tool {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  gap: 10px;
}

.layout-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.toolbar-select {
  width: 88px;
}

.toolbar-spacer {
  flex: 1;
}

.layout-workbench {
  display: grid;
  grid-template-columns: 138px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
  gap: 10px;
}

.page-navigator,
.preview-panel {
  min-height: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.page-navigator {
  padding: 8px;
  overflow: auto;
}

.navigator-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.navigator-title strong {
  color: #1f2937;
  font-size: 14px;
}

.navigator-title span {
  color: #6b7280;
  font-size: 12px;
}

.navigator-empty {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #9ca3af;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
}

.page-thumb {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 8px;
  margin-bottom: 10px;
  color: #374151;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}

.page-thumb__paper {
  position: relative;
  width: 100%;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.page-thumb__item {
  position: absolute;
  background: color-mix(in srgb, var(--theme-menu-active) 30%, #ffffff);
  border: 1px solid var(--theme-menu-active);
}

.preview-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.preview-toolbar {
  height: 40px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #eef2f7;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-title strong {
  color: #111827;
  font-size: 15px;
}

.preview-title span,
.page-count {
  color: #6b7280;
  font-size: 12px;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-actions :deep(.el-button) {
  width: 28px;
  height: 28px;
}

.zoom-label {
  min-width: 42px;
  color: #374151;
  text-align: center;
  font-size: 12px;
}

.preview-scrollbar {
  flex: 1;
  min-height: 0;
  background: #f3f4f6;
}

.preview-scrollbar :deep(.el-scrollbar__view) {
  height: 100%;
}

.preview-empty {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: #9ca3af;
  font-size: 13px;
}

.preview-empty svg {
  font-size: 28px;
}

.paper-stack {
  width: max-content;
  min-width: 100%;
  padding: 4px;
}

.paper-page-wrap {
  width: max-content;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-right: auto;
  margin-left: auto;
  margin-bottom: 8px;
}

.paper-page-scale {
  position: relative;
}

.paper-page {
  position: relative;
  box-sizing: border-box;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
  transform-origin: 0 0;
}

.paper-page::after {
  content: '';
  position: absolute;
  inset: var(--paper-margin, 0);
  pointer-events: none;
  border: 1px dashed rgba(20, 184, 166, 0.35);
}

.paper-image-frame {
  position: absolute;
  box-sizing: border-box;
  cursor: move;
  user-select: none;
  border: 1px solid rgba(17, 24, 39, 0.12);
}

.paper-image-frame.selected {
  border-color: var(--theme-menu-active);
  box-shadow: 0 0 0 2px var(--theme-menu-active-bg);
}

.paper-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  display: none;
  background: var(--theme-menu-active);
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: nwse-resize;
}

.paper-image-frame.selected .resize-handle {
  display: block;
}
</style>
