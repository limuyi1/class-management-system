<script setup lang="ts">
import { computed, nextTick, shallowRef } from 'vue'
import { ElLoading, ElMessage } from 'element-plus'

import { PagesEnum } from '@/types/Common'
import type { SeatingChartType } from '@/types/SeatingChart'
import {
  createSeatingChartPdf,
  downloadSeatingChartBlob,
  formatSeatingChartExportDate,
  renderSeatingChartPngBlob,
  sanitizeSeatingChartFileName,
  type SeatingChartExportFormatType
} from '@/utils/seatingChartExportUntil'
import SeatingChartExportPreview from '@/views/seating-chart/components/SeatingChartExportPreview.vue'
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'

const props = defineProps<{
  modelValue: boolean
  chart: SeatingChartType
  studentNames: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const previewRef = shallowRef<InstanceType<typeof SeatingChartExportPreview> | null>(null)
const format = shallowRef<SeatingChartExportFormatType>('png')
const pageType = shallowRef<PagesEnum>(PagesEnum.A4)
const scale = shallowRef(2)
const showEmptyLabels = shallowRef(true)
const exporting = shallowRef(false)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})
const largeChartTip = computed(() => {
  if (props.chart.columns <= 10) return ''
  return format.value === 'pdf'
    ? '当前列数较多，打印时建议选择 A3，以保证姓名清晰。'
    : '当前列数较多，图片尺寸会比较大，生成过程可能需要几秒。'
})

async function handleExport(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  const loading = ElLoading.service({ lock: true, text: '正在生成座位表...' })
  try {
    const baseName = `${sanitizeSeatingChartFileName(props.chart.name)}_${formatSeatingChartExportDate()}`
    if (format.value === 'png') {
      await nextTick()
      const element = previewRef.value?.getElement()
      if (!element) throw new Error('座位表预览尚未准备完成')
      const imageBlob = await renderSeatingChartPngBlob(element, scale.value)
      downloadSeatingChartBlob(imageBlob, `${baseName}.png`)
    } else {
      const pdfBlob = await createSeatingChartPdf({
        chart: props.chart,
        studentNames: props.studentNames,
        showEmptyLabels: showEmptyLabels.value,
        pageType: pageType.value
      })
      downloadSeatingChartBlob(pdfBlob, `${baseName}.pdf`)
    }
    ElMessage.success('座位表导出成功')
  } catch (error) {
    console.error('导出座位表失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '座位表导出失败')
  } finally {
    loading.close()
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
      <aside class="export-settings">
        <section class="setting-section">
          <div class="setting-heading">
            <span class="setting-index">01</span>
            <div><strong>文件格式</strong><small>选择使用场景</small></div>
          </div>
          <el-radio-group v-model="format" class="format-options">
            <el-radio-button value="png">高清 PNG</el-radio-button>
            <el-radio-button value="pdf">打印 PDF</el-radio-button>
          </el-radio-group>
        </section>

        <section v-if="format === 'pdf'" class="setting-section">
          <div class="setting-heading">
            <span class="setting-index">02</span>
            <div><strong>纸张规格</strong><small>自动使用横向页面</small></div>
          </div>
          <el-select v-model="pageType" class="setting-control">
            <el-option label="A4 · 常规打印" :value="PagesEnum.A4" />
            <el-option label="A3 · 大座位表" :value="PagesEnum.A3" />
          </el-select>
        </section>

        <section v-if="format === 'png'" class="setting-section">
          <div class="setting-heading">
            <span class="setting-index">02</span>
            <div><strong>清晰度</strong><small>更高清的文件体积更大</small></div>
          </div>
          <el-select v-model="scale" class="setting-control">
            <el-option label="标准 · 2 倍" :value="2" />
            <el-option label="超清 · 3 倍" :value="3" />
          </el-select>
        </section>

        <section class="setting-section setting-section--switch">
          <div>
            <strong>显示“空座位”</strong>
            <small>关闭后仍保留空座轮廓</small>
          </div>
          <el-switch v-model="showEmptyLabels" />
        </section>

        <div v-if="largeChartTip" class="large-chart-tip">
          <font-awesome-icon :icon="['solid', 'circle-info']" />
          <span>{{ largeChartTip }}</span>
        </div>
      </aside>

      <div class="preview-panel">
        <div class="preview-toolbar">
          <span><i></i>实时预览</span>
          <small>导出内容不受当前画布缩放影响</small>
        </div>
        <div class="preview-scroll">
          <SeatingChartExportPreview
            ref="previewRef"
            :chart="chart"
            :student-names="studentNames"
            :show-empty-labels="showEmptyLabels"
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
            导出{{ format === 'png' ? '图片' : ' PDF' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.export-workspace {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid #e4deea;
  border-radius: 14px;
  background: #f3f0f6;
}

.export-settings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px;
  background: #fbfafc;
  border-right: 1px solid #e4deea;
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
.setting-control {
  width: 100%;
}

.format-options :deep(.el-radio-button) {
  width: 50%;
}

.format-options :deep(.el-radio-button__inner) {
  width: 100%;
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
  align-items: flex-start;
  padding: 24px;
  overflow: auto;
}

.preview-scroll :deep(.seating-export-sheet) {
  margin: auto;
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
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-right: 0;
    border-bottom: 1px solid #e4deea;
  }

  .large-chart-tip {
    margin-top: 0;
  }
}
</style>
