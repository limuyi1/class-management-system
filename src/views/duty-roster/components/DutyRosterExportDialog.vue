<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import { ElLoading, ElMessage } from 'element-plus'

import { PagesEnum } from '@/types/Common'
import type { DutyRosterType } from '@/types/DutyRoster'
import {
  createDutyRosterPdf,
  downloadDutyRosterBlob,
  formatDutyRosterExportDate,
  renderDutyRosterPngBlob,
  sanitizeDutyRosterFileName,
  type DutyRosterExportFormatType
} from '@/utils/dutyRosterExportUntil'
import { buildDutyRosterPageLayout } from '@/utils/dutyRosterPageLayoutUntil'
import DutyRosterExportPreview from '@/views/duty-roster/components/DutyRosterExportPreview.vue'
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'

const PDF_IMAGE_SCALE = 3

const props = defineProps<{
  modelValue: boolean
  roster: DutyRosterType
  studentNames: Record<string, string>
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const previewRef = shallowRef<InstanceType<typeof DutyRosterExportPreview> | null>(null)
const format = shallowRef<DutyRosterExportFormatType>('png')
const pageType = shallowRef<PagesEnum>(PagesEnum.A4)
const layoutScalePercent = shallowRef(100)
const imageScale = shallowRef(2)
const showTitle = shallowRef(true)
const showNotes = shallowRef(true)
const exporting = shallowRef(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})
const selectedLayout = computed(() =>
  buildDutyRosterPageLayout(
    props.roster,
    pageType.value,
    layoutScalePercent.value / 100,
    showTitle.value,
    showNotes.value
  )
)
const denseRosterTip = computed(() => {
  if (layoutScalePercent.value > 100) {
    return '当前比例超过自动适配范围，部分内容可能进入页边距或被裁切。'
  }
  if (selectedLayout.value.fontScale >= 0.72) return ''
  return '当前岗位或值日行较多，已缩放到单页；如姓名偏小，建议选择 A3。'
})

watch(
  () => props.modelValue,
  (dialogVisible) => {
    if (!dialogVisible) return
    layoutScalePercent.value = 100
  },
  { immediate: true }
)

function resetLayoutScale(): void {
  layoutScalePercent.value = 100
}

async function exportRoster(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  const loading = ElLoading.service({ lock: true, text: '正在生成值日表...' })
  try {
    await nextTick()
    const element = previewRef.value?.getElement()
    if (!element) throw new Error('值日表预览尚未准备完成')
    const baseName = `${sanitizeDutyRosterFileName(props.roster.name)}_${formatDutyRosterExportDate()}`

    if (format.value === 'png') {
      const imageBlob = await renderDutyRosterPngBlob(element, imageScale.value)
      downloadDutyRosterBlob(imageBlob, `${baseName}.png`)
    } else {
      const imageBlob = await renderDutyRosterPngBlob(element, PDF_IMAGE_SCALE)
      const pdfBlob = await createDutyRosterPdf({ imageBlob, pageType: pageType.value })
      downloadDutyRosterBlob(pdfBlob, `${baseName}.pdf`)
    }
    ElMessage.success('值日表导出成功')
  } catch (error) {
    console.error('导出值日表失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '值日表导出失败')
  } finally {
    loading.close()
    exporting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="duty-export-dialog"
    width="min(1180px, 94vw)"
    append-to-body
    destroy-on-close
    align-center
  >
    <template #header>
      <SeatingDialogHeader
        icon="file-export"
        title="导出值日表"
        description="生成适合分享或教室张贴的完整值日安排"
      />
    </template>

    <div class="export-workspace">
      <aside class="export-settings">
        <el-scrollbar class="export-settings__scroll">
          <div class="export-settings__content">
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

            <section class="setting-section">
              <div class="setting-heading">
                <span class="setting-index">02</span>
                <div><strong>纸张设置</strong><small>横向内容自动适应单页</small></div>
              </div>
              <el-select v-model="pageType" class="setting-control">
                <el-option label="A4 · 常规打印" :value="PagesEnum.A4" />
                <el-option label="A3 · 大值日表" :value="PagesEnum.A3" />
              </el-select>
            </section>

            <section class="setting-section">
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
              <el-select v-model="imageScale" class="setting-control">
                <el-option label="标准 · 2 倍" :value="2" />
                <el-option label="超清 · 3 倍" :value="3" />
              </el-select>
            </section>

            <section class="setting-section setting-section--switch">
              <div><strong>显示标题</strong><small>关闭后同时隐藏标题分隔线</small></div>
              <el-switch v-model="showTitle" />
            </section>

            <section class="setting-section setting-section--switch">
              <div><strong>显示备注说明</strong><small>统一显示在表格下方</small></div>
              <el-switch v-model="showNotes" />
            </section>

            <div v-if="denseRosterTip" class="large-roster-tip">
              <font-awesome-icon :icon="['solid', 'circle-info']" />
              <span>{{ denseRosterTip }}</span>
            </div>
          </div>
        </el-scrollbar>
      </aside>

      <div class="preview-panel">
        <div class="preview-toolbar">
          <span><i></i>实时预览</span>
          <small>纸张预览已自动适应窗口</small>
        </div>
        <div class="preview-scroll">
          <DutyRosterExportPreview
            ref="previewRef"
            :roster="roster"
            :student-names="studentNames"
            :page-type="pageType"
            :show-title="showTitle"
            :show-notes="showNotes"
            :layout-scale-percent="layoutScalePercent"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span>
          {{ roster.name }} · {{ selectedLayout.positionCount }} 个岗位 ·
          {{ selectedLayout.rowCount }} 个值日行
        </span>
        <div>
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="exporting" @click="exportRoster">
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
  height: clamp(520px, calc(100vh - 220px), 680px);
  min-height: 0;
  grid-template-columns: 248px minmax(0, 1fr);
  overflow: hidden;
  background: #f3f0f6;
  border: 1px solid #e4deea;
  border-radius: 14px;
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
.large-roster-tip {
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
  color: #694696;
  background: #eee7f7;
  border-radius: 7px;
  font-family: Georgia, serif;
  font-size: 10px;
  font-weight: 700;
  place-items: center;
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

.large-roster-tip {
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
  padding: 16px;
  overflow: hidden;
}

.preview-scroll :deep(.duty-print-sheet) {
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

  .large-roster-tip {
    margin-top: 0;
  }
}
</style>
