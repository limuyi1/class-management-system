<script setup lang="ts">
/** 座位表导出弹窗 — 配置格式、纸张、缩放并生成 PNG/PDF 下载 */
import { computed, nextTick, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { startLoading, stopLoading } from '@/hooks/useLoading'

import { PagesEnum } from '@/types/Common'
import type { SeatingChartType } from '@/types/SeatingChart'
import {
  createSeatingChartPdf,
  downloadSeatingChartBlob,
  formatSeatingChartExportDate,
  renderSeatingChartPngBlob,
  sanitizeSeatingChartFileName,
  type SeatingChartExportFormatType
} from '@/utils/seating-chart/seatingChartExportUtil'
import {
  buildSeatingChartPageLayout,
  resolveSeatingChartPageOrientation
} from '@/utils/seating-chart/seatingChartPageLayoutUtil'
import { exportSeatingChartExcel } from '@/utils/seating-chart/seatingChartExcelUtil'
import SeatingChartExportPreview from '@/views/seating-chart/components/SeatingChartExportPreview.vue'
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'

import type { SeatingChartPageOrientationType } from '@/utils/seating-chart/seatingChartPageLayoutUtil'

/** PDF 导出的图片渲染倍数，保证打印清晰度 */
const PDF_IMAGE_SCALE = 3

const props = defineProps<{
  /** 弹窗显隐状态（v-model 双向绑定） */
  modelValue: boolean
  /** 当前座位表 */
  chart: SeatingChartType
  /** 学生 ID 到姓名的映射 */
  studentNames: Record<string, string>
}>()

/** 事件：更新弹窗显隐状态 */
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// 预览组件实例，用于获取待导出的 DOM 元素
const previewRef = shallowRef<InstanceType<typeof SeatingChartExportPreview> | null>(null)
// 导出配置：文件格式、纸张与方向
const format = shallowRef<SeatingChartExportFormatType>('png')
const pageType = shallowRef<PagesEnum>(PagesEnum.A4)
const orientation = shallowRef<SeatingChartPageOrientationType>('landscape')
// 方向模式：auto 智能跟随 / manual 手动选择
const orientationMode = shallowRef<'auto' | 'manual'>('auto')
// 版面缩放百分比与 PNG 清晰度倍数
const layoutScalePercent = shallowRef(100)
const scale = shallowRef(2)
// 是否显示标题与“空座位”标签
const showTitle = shallowRef(true)
const showEmptyLabels = shallowRef(true)
const showRoles = shallowRef(true)
const showLegend = shallowRef(true)
const showNotes = shallowRef(true)
// 导出进行中状态，防止重复触发
const exporting = shallowRef(false)

/** 双向绑定的弹窗显隐状态 */
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})
/** 根据纸张与标题设置推荐的页面方向 */
const recommendedOrientation = computed(() =>
  resolveSeatingChartPageOrientation(props.chart, pageType.value, showTitle.value)
)
/** 根据纸张、方向与缩放比例计算当前页面布局 */
const selectedLayout = computed(() =>
  buildSeatingChartPageLayout(
    props.chart,
    pageType.value,
    orientation.value,
    layoutScalePercent.value / 100,
    showTitle.value
  )
)
/** 当前页面方向的中文标签 */
const orientationLabel = computed(() => (orientation.value === 'portrait' ? '纵向' : '横向'))
/** 大座位表提示文案：比例超范围或字号过小时给出建议 */
const largeChartTip = computed(() => {
  if (format.value === 'xlsx') return ''
  if (layoutScalePercent.value > 100) {
    return '当前比例超过自动适配范围，部分内容可能进入页边距或被裁切。'
  }
  if (selectedLayout.value.fontScale >= 0.72) return ''
  return '当前座位较多，已缩放到单页；如姓名偏小，建议选择 A3。'
})
/** 当前格式对应的导出按钮文案。 */
const exportButtonText = computed(() => {
  if (format.value === 'png') return '导出图片'
  if (format.value === 'pdf') return '导出 PDF'
  return '导出 Excel'
})

// 打开弹窗时重置为智能方向与默认缩放
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    orientationMode.value = 'auto'
    orientation.value = recommendedOrientation.value
    layoutScalePercent.value = 100
  },
  { immediate: true }
)

// 纸张或推荐方向变化时，智能模式下自动跟随
watch([pageType, recommendedOrientation], () => {
  if (!props.modelValue || orientationMode.value === 'manual') return
  orientation.value = recommendedOrientation.value
})

/**
 * 手动选择页面方向。
 * @param value - 页面方向
 */
function selectOrientation(value: SeatingChartPageOrientationType): void {
  orientation.value = value
  orientationMode.value = 'manual'
}

/** 恢复智能方向模式 */
function useRecommendedOrientation(): void {
  orientationMode.value = 'auto'
  orientation.value = recommendedOrientation.value
}

/** 恢复版面缩放为 100% */
function resetLayoutScale(): void {
  layoutScalePercent.value = 100
}

/**
 * 生成并下载座位表导出文件；PNG 直接渲染，PDF 先渲染图片再合成。
 */
async function handleExport(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  startLoading('正在生成座位表...')
  try {
    if (format.value === 'xlsx') {
      exportSeatingChartExcel(props.chart, props.studentNames)
      ElMessage.success('座位表 Excel 导出成功')
      return
    }
    const baseName = `${sanitizeSeatingChartFileName(props.chart.name)}_${formatSeatingChartExportDate()}`
    await nextTick()
    const element = previewRef.value?.getElement()
    if (!element) throw new Error('座位表预览尚未准备完成')

    if (format.value === 'png') {
      const imageBlob = await renderSeatingChartPngBlob(element, scale.value)
      downloadSeatingChartBlob(imageBlob, `${baseName}.png`)
    } else {
      // PDF 使用固定高倍渲染，保证打印清晰度
      const imageBlob = await renderSeatingChartPngBlob(element, PDF_IMAGE_SCALE)
      const pdfBlob = await createSeatingChartPdf({
        imageBlob,
        pageType: pageType.value,
        orientation: orientation.value
      })
      downloadSeatingChartBlob(pdfBlob, `${baseName}.pdf`)
    }
    ElMessage.success('座位表导出成功')
  } catch (error) {
    console.error('导出座位表失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '座位表导出失败')
  } finally {
    stopLoading()
    exporting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    class="seating-export-dialog"
    width="min(1180px, 94vw)"
    destroy-on-close
    align-center
  >
    <template #header>
      <SeatingDialogHeader
        icon="file-export"
        title="导出座位表"
        description="生成适合分享或打印的完整教室座位图"
      />
    </template>

    <div class="export-workspace">
      <!-- 左侧：导出配置面板 -->
      <aside class="export-settings">
        <el-scrollbar class="export-settings__scroll">
          <div class="export-settings__content">
            <section class="setting-section">
              <div class="setting-heading">
                <span class="setting-index">01</span>
                <div><strong>文件格式</strong><small>选择使用场景</small></div>
              </div>
              <el-radio-group v-model="format" class="format-options">
                <el-radio-button value="png">PNG</el-radio-button>
                <el-radio-button value="pdf">PDF</el-radio-button>
                <el-radio-button value="xlsx">Excel</el-radio-button>
              </el-radio-group>
            </section>

            <section v-if="format !== 'xlsx'" class="setting-section">
              <div class="setting-heading">
                <span class="setting-index">02</span>
                <div><strong>纸张设置</strong><small>内容自动适应单页</small></div>
              </div>
              <el-select v-model="pageType" class="setting-control">
                <el-option label="A4 · 常规打印" :value="PagesEnum.A4" />
                <el-option label="A3 · 大座位表" :value="PagesEnum.A3" />
              </el-select>
              <el-radio-group v-model="orientation" class="orientation-options">
                <el-radio-button value="portrait" @click="selectOrientation('portrait')">
                  纵向
                </el-radio-button>
                <el-radio-button value="landscape" @click="selectOrientation('landscape')">
                  横向
                </el-radio-button>
              </el-radio-group>
              <div class="orientation-hint">
                <span v-if="orientationMode === 'auto'">已智能选择{{ orientationLabel }}</span>
                <span v-else>当前为手动选择</span>
                <el-button
                  v-if="orientationMode === 'manual'"
                  link
                  type="primary"
                  @click="useRecommendedOrientation"
                >
                  恢复智能
                </el-button>
              </div>
            </section>

            <section v-if="format !== 'xlsx'" class="setting-section">
              <div class="setting-heading setting-heading--scale">
                <span class="setting-index">03</span>
                <div><strong>版面缩放</strong><small>缩放纸张上的全部内容</small></div>
                <span class="scale-value">{{ layoutScalePercent }}%</span>
              </div>
              <el-slider
                v-model="layoutScalePercent"
                :min="70"
                :max="150"
                :step="5"
                :show-tooltip="false"
              />
              <div class="scale-range">
                <span>70%</span>
                <el-button
                  v-if="layoutScalePercent !== 100"
                  link
                  type="primary"
                  @click="resetLayoutScale"
                >
                  恢复 100%
                </el-button>
                <span>150%</span>
              </div>
            </section>

            <section v-if="format === 'png'" class="setting-section">
              <div class="setting-heading">
                <span class="setting-index">04</span>
                <div><strong>清晰度</strong><small>更高清的文件体积更大</small></div>
              </div>
              <el-select v-model="scale" class="setting-control">
                <el-option label="标准 · 2 倍" :value="2" />
                <el-option label="超清 · 3 倍" :value="3" />
              </el-select>
            </section>

            <section v-if="format !== 'xlsx'" class="setting-section setting-section--switch">
              <div>
                <strong>显示标题</strong>
                <small>关闭后同时隐藏标题分隔线</small>
              </div>
              <el-switch v-model="showTitle" />
            </section>

            <section v-if="format !== 'xlsx'" class="setting-section setting-section--switch">
              <div>
                <strong>显示“空座位”</strong>
                <small>关闭后仍保留空座轮廓</small>
              </div>
              <el-switch v-model="showEmptyLabels" />
            </section>

            <section v-if="format !== 'xlsx'" class="setting-section setting-section--switch">
              <div>
                <strong>显示职务标注</strong>
                <small>显示组长、副组长与课代表标签</small>
              </div>
              <el-switch v-model="showRoles" />
            </section>

            <section v-if="format !== 'xlsx'" class="setting-section setting-section--switch">
              <div>
                <strong>显示职务图例</strong>
                <small>解释颜色与简称的含义</small>
              </div>
              <el-switch v-model="showLegend" :disabled="!showRoles" />
            </section>

            <section v-if="format !== 'xlsx'" class="setting-section setting-section--switch">
              <div>
                <strong>显示备注说明</strong>
                <small>统一显示在座位表下方</small>
              </div>
              <el-switch v-model="showNotes" />
            </section>

            <div v-if="largeChartTip" class="large-chart-tip">
              <font-awesome-icon :icon="['solid', 'circle-info']" />
              <span>{{ largeChartTip }}</span>
            </div>
          </div>
        </el-scrollbar>
      </aside>

      <!-- 右侧：实时预览面板 -->
      <div class="preview-panel">
        <div class="preview-toolbar">
          <span><i></i>实时预览</span>
          <small>{{ format === 'xlsx' ? 'Excel 将保留座位方向与过道' : '纸张预览已自动适应窗口' }}</small>
        </div>
        <div v-if="format === 'xlsx'" class="excel-preview-placeholder">
          <font-awesome-icon :icon="['solid', 'file-excel']" />
          <strong>Excel 成果表</strong>
          <span>包含讲台、特殊座位、过道、学生姓名、职务和备注说明</span>
        </div>
        <div v-else class="preview-scroll">
          <SeatingChartExportPreview
            ref="previewRef"
            :chart="chart"
            :student-names="studentNames"
            :show-title="showTitle"
            :show-empty-labels="showEmptyLabels"
            :show-roles="showRoles"
            :show-legend="showLegend"
            :show-notes="showNotes"
            :page-type="pageType"
            :orientation="orientation"
            :layout-scale-percent="layoutScalePercent"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span>{{ chart.name }} · {{ chart.rows }} 排 {{ chart.columns }} 列</span>
        <div>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="exporting" @click="handleExport">
            <font-awesome-icon v-if="!exporting" :icon="['solid', 'download']" />
            {{ exportButtonText }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.export-workspace {
  display: grid;
  height: clamp(520px, calc(100vh - 220px), 680px);
  min-height: 0;
  grid-template-columns: 248px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #e4deea;
  border-radius: 14px;
  background: #f3f0f6;
}

.export-settings {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #fbfafc;
  border-right: 1px solid #e4deea;
}

.export-settings__scroll {
  height: 100%;
}

.export-settings__content {
  display: flex;
  min-height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  gap: 4px;
  padding: 18px;
}

.setting-section {
  padding: 14px 0 16px;
  border-bottom: 1px solid #ece7f0;
}

.setting-heading,
.setting-section--switch,
.dialog-footer,
.preview-toolbar,
.large-chart-tip {
  display: flex;
  align-items: center;
}

.setting-heading {
  gap: 10px;
  margin-bottom: 12px;
}

.setting-index {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: #694696;
  background: #eee7f7;
  border-radius: 7px;
  font-family: Georgia, serif;
  font-size: 10px;
  font-weight: 700;
}

.setting-heading div,
.setting-section--switch div {
  display: grid;
  gap: 3px;
}

.setting-heading strong,
.setting-section--switch strong {
  color: #342a3d;
  font-size: 13px;
}

.setting-heading small,
.setting-section--switch small {
  color: #93899b;
  font-size: 10px;
}

.format-options,
.orientation-options,
.setting-control {
  width: 100%;
}

.format-options :deep(.el-radio-button),
.orientation-options :deep(.el-radio-button) {
  width: 50%;
}

.format-options :deep(.el-radio-button) {
  width: 33.333%;
}

.format-options :deep(.el-radio-button__inner),
.orientation-options :deep(.el-radio-button__inner) {
  width: 100%;
}

.orientation-options {
  margin-top: 10px;
}

.orientation-hint {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  margin-top: 3px;
  color: #93899b;
  font-size: 10px;
}

.orientation-hint :deep(.el-button) {
  height: 24px;
  padding: 0;
  font-size: 10px;
}

.setting-heading--scale .scale-value {
  min-width: 42px;
  margin-left: auto;
  padding: 4px 7px;
  color: #5d3f7d;
  background: #eee7f7;
  border-radius: 6px;
  font-family: Georgia, serif;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.setting-section :deep(.el-slider) {
  --el-slider-main-bg-color: #694696;
  --el-slider-runway-bg-color: #e8e1ed;
  padding-inline: 4px;
}

.scale-range {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  color: #a098a6;
  font-size: 9px;
}

.scale-range :deep(.el-button) {
  height: 24px;
  padding: 0;
  font-size: 10px;
}

.setting-section--switch {
  justify-content: space-between;
}

.large-chart-tip {
  gap: 8px;
  margin-top: auto;
  padding: 11px;
  color: #755c3c;
  background: #fff8e8;
  border: 1px solid #eadab5;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.45;
}

.preview-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.excel-preview-placeholder {
  display: grid;
  flex: 1;
  place-content: center;
  justify-items: center;
  gap: 10px;
  color: #697386;
  text-align: center;
}

.excel-preview-placeholder svg {
  color: #2e8b57;
  font-size: 42px;
}

.excel-preview-placeholder strong {
  color: #342a3d;
  font-size: 16px;
}

.excel-preview-placeholder span {
  max-width: 360px;
  font-size: 12px;
  line-height: 1.6;
}

.preview-toolbar {
  justify-content: space-between;
  padding: 12px 16px;
  color: #544b5d;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid #e4deea;
  font-size: 11px;
}

.preview-toolbar span {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 650;
}

.preview-toolbar i {
  width: 7px;
  height: 7px;
  background: #63a779;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(99, 167, 121, 0.14);
}

.preview-toolbar small {
  color: #948a9c;
}

.preview-scroll {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  padding: 16px;
  overflow: hidden;
}

.preview-scroll :deep(.seating-export-sheet) {
  box-shadow: 0 18px 45px rgba(57, 43, 67, 0.13);
}

.dialog-footer {
  justify-content: space-between;
  gap: 20px;
}

.dialog-footer > span {
  overflow: hidden;
  color: #8a8091;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 880px) {
  .export-workspace {
    grid-template-columns: 1fr;
  }

  .export-settings {
    border-right: 0;
    border-bottom: 1px solid #e4deea;
  }

  .export-settings__content {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .large-chart-tip {
    margin-top: 0;
  }
}
</style>
