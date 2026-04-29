<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'
import { PDFDocument, type PDFImage } from 'pdf-lib'

import { PagesEnum } from '@/types/Common'
import { useToolsStore } from '@/stores/tools'
import { getPdfPageSize } from '@/utils/evaluationPdfLayoutUntil'
import { mmToPixelPrecise } from '@/utils/pageSizeInPixelUntil'

interface UploadedImageType {
  id: string
  name: string
  dataUrl: string
  width: number
  height: number
  mimeType: string
}

interface LayoutImageType {
  image: UploadedImageType
  x: number
  y: number
  width: number
  height: number
}

interface LayoutPageType {
  id: string
  items: LayoutImageType[]
}

const pointPerMm = 72 / 25.4
const fileInputRef = ref<HTMLInputElement | null>(null)
const images = ref<UploadedImageType[]>([])
const exporting = ref(false)
const toolsStore = useToolsStore()
const settings = toolsStore.paperLayout

const pageSize = computed(() => {
  const size = getPdfPageSize(settings.pageType)
  if (settings.orientation === 'landscape') {
    return {
      width: size.height,
      height: size.width
    }
  }
  return size
})

const contentWidth = computed(() => pageSize.value.width - settings.margin * 2)
const contentHeight = computed(() => pageSize.value.height - settings.margin * 2)

const columnWidth = computed(() => {
  return (contentWidth.value - settings.gap * (settings.columns - 1)) / settings.columns
})

const pageStyle = computed(() => ({
  width: `${mmToPixelPrecise(pageSize.value.width)}px`,
  height: `${mmToPixelPrecise(pageSize.value.height)}px`,
  '--paper-margin': `${mmToPixelPrecise(settings.margin)}px`
}))

const layoutPages = computed<LayoutPageType[]>(() => {
  if (images.value.length === 0) return []

  const pages: LayoutPageType[] = [{ id: createId('page'), items: [] }]
  let currentY = settings.margin

  for (let index = 0; index < images.value.length; index += settings.columns) {
    const rowImages = images.value.slice(index, index + settings.columns)
    let cursorX = settings.margin
    const rowItems = rowImages.map((image) => {
      const imageHeight = columnWidth.value * (image.height / image.width)
      const fitScale = imageHeight > contentHeight.value ? contentHeight.value / imageHeight : 1
      const width = columnWidth.value * fitScale
      const height = imageHeight * fitScale
      const x = cursorX
      cursorX += width + settings.gap

      return {
        image,
        x,
        y: currentY,
        width,
        height
      }
    })

    const rowHeight = Math.max(...rowItems.map((item) => item.height))
    if (currentY > settings.margin && currentY + rowHeight > pageSize.value.height - settings.margin) {
      pages.push({ id: createId('page'), items: [] })
      currentY = settings.margin
      rowItems.forEach((item) => {
        item.y = currentY
      })
    }

    pages[pages.length - 1].items.push(...rowItems)
    currentY += rowHeight + settings.gap
  }

  return pages
})

const uploadHint = computed(() => {
  if (images.value.length === 0) return '支持 PNG、JPG、JPEG、WEBP'
  return `已上传 ${images.value.length} 张，自动生成 ${layoutPages.value.length} 页`
})

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function handleUploadClick(): void {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''

  if (files.length === 0) return

  const validFiles = files.filter((file) => file.type.startsWith('image/'))
  if (validFiles.length !== files.length) {
    ElMessage.warning('已忽略非图片文件')
  }

  try {
    const nextImages = await Promise.all(validFiles.map(readImageFile))
    images.value = [...images.value, ...nextImages]
  } catch (error) {
    console.error('读取图片失败:', error)
    ElMessage.error('读取图片失败')
  }
}

function readImageFile(file: File): Promise<UploadedImageType> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '')
      const image = new Image()
      image.onload = async () => {
        try {
          const normalized = await normalizeImageDataUrl(rawDataUrl, file.type)
          resolve({
            id: createId('image'),
            name: file.name,
            dataUrl: normalized.dataUrl,
            width: image.naturalWidth,
            height: image.naturalHeight,
            mimeType: normalized.mimeType
          })
        } catch (error) {
          reject(error)
        }
      }
      image.onerror = () => reject(new Error('图片加载失败'))
      image.src = rawDataUrl
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function normalizeImageDataUrl(
  dataUrl: string,
  mimeType: string
): Promise<{ dataUrl: string; mimeType: string }> {
  if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
    return Promise.resolve({ dataUrl, mimeType })
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('无法创建图片画布'))
        return
      }

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        mimeType: 'image/png'
      })
    }
    image.onerror = () => reject(new Error('图片格式转换失败'))
    image.src = dataUrl
  })
}

function removeImage(id: string): void {
  images.value = images.value.filter((image) => image.id !== id)
}

async function clearImages(): Promise<void> {
  if (images.value.length === 0) return

  try {
    await ElMessageBox.confirm('确认清空已上传的图片？', '清空图片', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })
    images.value = []
  } catch {
    // 用户取消时不需要提示
  }
}

async function exportPdf(): Promise<void> {
  if (layoutPages.value.length === 0) {
    ElMessage.warning('请先上传试卷图片')
    return
  }

  exporting.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出 PDF...'
  })

  try {
    const pdfDoc = await PDFDocument.create()
    const cache = new Map<string, PDFImage>()
    const pdfWidth = pageSize.value.width * pointPerMm
    const pdfHeight = pageSize.value.height * pointPerMm

    for (const pageLayout of layoutPages.value) {
      const page = pdfDoc.addPage([pdfWidth, pdfHeight])

      for (const item of pageLayout.items) {
        const embeddedImage = await getEmbeddedImage(pdfDoc, cache, item.image)
        page.drawImage(embeddedImage, {
          x: item.x * pointPerMm,
          y: pdfHeight - (item.y + item.height) * pointPerMm,
          width: item.width * pointPerMm,
          height: item.height * pointPerMm
        })
      }
    }

    const bytes = await pdfDoc.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
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

async function getEmbeddedImage(
  pdfDoc: PDFDocument,
  cache: Map<string, PDFImage>,
  image: UploadedImageType
) {
  const cached = cache.get(image.id)
  if (cached) return cached

  const imageBytes = await fetch(image.dataUrl).then((response) => response.arrayBuffer())
  const embeddedImage =
    image.mimeType === 'image/jpeg'
      ? await pdfDoc.embedJpg(imageBytes)
      : await pdfDoc.embedPng(imageBytes)
  cache.set(image.id, embeddedImage)
  return embeddedImage
}
</script>

<template>
  <div class="paper-layout-tool">
    <aside class="tool-sidebar">
      <section class="tool-panel upload-panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">图片素材</h3>
            <p class="panel-subtitle">{{ uploadHint }}</p>
          </div>
          <el-tooltip content="清空图片" placement="top">
            <el-button size="small" circle :disabled="images.length === 0" @click="clearImages">
              <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
            </el-button>
          </el-tooltip>
        </div>

        <input
          ref="fileInputRef"
          class="file-input"
          type="file"
          accept="image/*"
          multiple
          @change="handleFileChange"
        />

        <button class="upload-button" type="button" @click="handleUploadClick">
          <font-awesome-icon :icon="['solid', 'cloud-arrow-up']" />
          <span>上传试卷图片</span>
        </button>

        <el-scrollbar class="image-list">
          <div v-if="images.length === 0" class="empty-state">
            <font-awesome-icon :icon="['solid', 'image']" />
            <span>上传后会按顺序自动排版</span>
          </div>
          <div v-for="(image, index) in images" :key="image.id" class="image-item">
            <img :src="image.dataUrl" :alt="image.name" />
            <div class="image-meta">
              <strong>{{ index + 1 }}. {{ image.name }}</strong>
              <span>{{ image.width }} × {{ image.height }}</span>
            </div>
            <el-tooltip content="删除" placement="top">
              <el-button size="small" circle @click="removeImage(image.id)">
                <template #icon><font-awesome-icon :icon="['solid', 'xmark']" /></template>
              </el-button>
            </el-tooltip>
          </div>
        </el-scrollbar>
      </section>

      <section class="tool-panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">排版参数</h3>
            <p class="panel-subtitle">按列宽等比缩放</p>
          </div>
        </div>

        <el-form label-position="top" class="layout-form">
          <el-form-item label="纸张规格">
            <el-select v-model="settings.pageType" class="w-full">
              <el-option label="A4" :value="PagesEnum.A4" />
              <el-option label="A3" :value="PagesEnum.A3" />
              <el-option label="B4" :value="PagesEnum.B4" />
              <el-option label="B3" :value="PagesEnum.B3" />
            </el-select>
          </el-form-item>

          <el-form-item label="页面方向">
            <el-segmented
              v-model="settings.orientation"
              :options="[
                { label: '纵向', value: 'portrait' },
                { label: '横向', value: 'landscape' }
              ]"
              block
            />
          </el-form-item>

          <el-form-item label="每行图片数">
            <el-segmented
              v-model="settings.columns"
              :options="[
                { label: '1', value: 1 },
                { label: '2', value: 2 },
                { label: '3', value: 3 },
                { label: '4', value: 4 }
              ]"
              block
            />
          </el-form-item>

          <el-form-item label="页边距（mm）">
            <el-input-number v-model="settings.margin" :min="0" :max="30" :step="1" />
          </el-form-item>

          <el-form-item label="图片间距（mm）">
            <el-input-number v-model="settings.gap" :min="0" :max="20" :step="1" />
          </el-form-item>
        </el-form>

        <el-button
          type="primary"
          class="export-button"
          :loading="exporting"
          :disabled="layoutPages.length === 0"
          @click="exportPdf"
        >
          <template #icon><font-awesome-icon :icon="['solid', 'file-pdf']" /></template>
          导出 PDF
        </el-button>
      </section>
    </aside>

    <main class="preview-panel">
      <div class="preview-toolbar">
        <div class="preview-title">
          <strong>排版预览</strong>
          <span>{{ settings.pageType }} {{ settings.orientation === 'portrait' ? '纵向' : '横向' }}</span>
        </div>
        <span class="page-count">共 {{ layoutPages.length }} 页</span>
      </div>

      <el-scrollbar class="preview-scrollbar">
        <div v-if="layoutPages.length === 0" class="preview-empty">
          <font-awesome-icon :icon="['solid', 'file-circle-plus']" />
          <span>上传图片后在这里预览试卷版式</span>
        </div>

        <div v-else class="paper-stack">
          <div v-for="(page, pageIndex) in layoutPages" :key="page.id" class="paper-page-wrap">
            <div class="page-number">第 {{ pageIndex + 1 }} 页</div>
            <div class="paper-page" :style="pageStyle">
              <img
                v-for="item in page.items"
                :key="item.image.id"
                class="paper-image"
                :src="item.image.dataUrl"
                :alt="item.image.name"
                :style="{
                  left: `${mmToPixelPrecise(item.x)}px`,
                  top: `${mmToPixelPrecise(item.y)}px`,
                  width: `${mmToPixelPrecise(item.width)}px`,
                  height: `${mmToPixelPrecise(item.height)}px`
                }"
              />
            </div>
          </div>
        </div>
      </el-scrollbar>
    </main>
  </div>
</template>

<style scoped lang="scss">
.paper-layout-tool {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
  gap: 10px;
}

.tool-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 10px;
}

.tool-panel,
.preview-panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.tool-panel {
  padding: 14px;
}

.upload-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.panel-header,
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  margin: 0;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.panel-subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.file-input {
  display: none;
}

.upload-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  margin: 14px 0;
  color: #0f766e;
  background: #ecfdf5;
  border: 1px dashed #5eead4;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.upload-button:hover {
  background: #d1fae5;
  border-color: #2dd4bf;
}

.image-list {
  min-height: 0;
  flex: 1;
}

.empty-state,
.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: #9ca3af;
  font-size: 13px;
}

.empty-state {
  min-height: 180px;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
}

.empty-state svg,
.preview-empty svg {
  font-size: 28px;
}

.image-item {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid #edf2f7;
  border-radius: 8px;
  margin-bottom: 8px;
}

.image-item img {
  width: 54px;
  height: 54px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.image-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-meta strong {
  overflow: hidden;
  color: #1f2937;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
}

.image-meta span {
  color: #6b7280;
  font-size: 12px;
}

.layout-form {
  margin-top: 12px;
}

.layout-form :deep(.el-input-number) {
  width: 100%;
}

.export-button {
  width: 100%;
  margin-top: 4px;
}

.preview-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.preview-toolbar {
  height: 54px;
  padding: 0 16px;
  border-bottom: 1px solid #eef2f7;
}

.preview-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
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

.preview-scrollbar {
  flex: 1;
  min-height: 0;
  background: #f3f4f6;
}

.preview-empty {
  height: 100%;
  min-height: 420px;
}

.paper-stack {
  width: max-content;
  min-width: 100%;
  padding: 22px;
}

.paper-page-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 22px;
}

.page-number {
  align-self: flex-start;
  margin: 0 0 8px;
  color: #6b7280;
  font-size: 12px;
}

.paper-page {
  position: relative;
  box-sizing: border-box;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
}

.paper-page::after {
  content: '';
  position: absolute;
  inset: var(--paper-margin, 0);
  pointer-events: none;
  border: 1px dashed rgba(20, 184, 166, 0.35);
}

.paper-image {
  position: absolute;
  box-sizing: border-box;
  object-fit: contain;
  background: #fff;
  border: 1px solid rgba(17, 24, 39, 0.12);
}
</style>
