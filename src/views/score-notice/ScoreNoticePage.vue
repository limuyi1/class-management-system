<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import PrintPreviewViewport from '@/components/print-workbench/PrintPreviewViewport.vue'
import ScoreNoticeControlPanel from './components/ScoreNoticeControlPanel.vue'
import ScoreNoticeImportDialog from './components/ScoreNoticeImportDialog.vue'
import ScoreNoticePreview from './components/ScoreNoticePreview.vue'
import { useScoreNoticeWorkbench } from './composables/useScoreNoticeWorkbench'
defineProps<{ embedded?: boolean }>()
const {
  store,
  importDialogVisible,
  aiConfigured,
  dataStore,
  batchGenerating,
  batchProcessed,
  batchTotal,
  singleGenerating,
  exporting,
  exportProcessed,
  exportStudent,
  exportContext,
  handleStopExport,
  previewRef,
  exportPreviewRef,
  controlPanelRef,
  fontFileInputRef,
  selectedStudent,
  displayHandwriteFontName,
  savedHandwriteFontName,
  handwriteFontApplying,
  handleChooseHandwriteFont,
  handleClearHandwriteFont,
  handleHandwriteFontChange,
  backToTools,
  handleGenerateBatch,
  handleStopBatch,
  handleGenerateSingle,
  handleImportConfirm,
  handleCopyImage,
  handleDownloadImage,
  handleExportPdf,
  handleExportZip
} = useScoreNoticeWorkbench()
</script>
<template>
  <div class="score-notice-page" :class="{ 'app-page-shell': !embedded }">
    <page-header
      v-if="!embedded"
      :icon="['solid', 'file-signature']"
      title="成绩通知"
      subtitle="导入考试等级或分数，生成可直接发给家长的成绩图片与短评"
    >
      <template #left>
        <el-tooltip content="返回工具" placement="top">
          <el-button size="small" circle aria-label="返回工具" @click="backToTools">
            <font-awesome-icon :icon="['solid', 'arrow-left']" />
          </el-button>
        </el-tooltip>
      </template>
    </page-header>

    <!-- 工作区：左侧实时预览 + 右侧制作面板 -->
    <main class="score-notice-page__workspace">
      <!-- 预览区域，报告按容器尺寸动态缩放 -->
      <PrintPreviewViewport :width="1448"
        ><score-notice-preview
          ref="previewRef"
          :title="store.title"
          :notice-date="store.noticeDate"
          :mode="store.mode"
          :subjects="store.subjects"
          :student="selectedStudent"
      /></PrintPreviewViewport>
      <score-notice-control-panel
        ref="controlPanelRef"
        :ai-configured="aiConfigured"
        :batch-generating="batchGenerating"
        :batch-processed="batchProcessed"
        :batch-total="batchTotal"
        :single-generating="singleGenerating"
        :handwrite-font-name="displayHandwriteFontName"
        :has-custom-handwrite-font="Boolean(savedHandwriteFontName)"
        :handwrite-font-applying="handwriteFontApplying"
        :exporting="exporting"
        :export-processed="exportProcessed"
        @open-import="importDialogVisible = true"
        @generate-batch="handleGenerateBatch"
        @stop-batch="handleStopBatch"
        @generate-single="handleGenerateSingle"
        @choose-handwrite-font="handleChooseHandwriteFont"
        @clear-handwrite-font="handleClearHandwriteFont"
        @copy-image="handleCopyImage"
        @download-image="handleDownloadImage"
        @export-pdf="handleExportPdf"
        @export-zip="handleExportZip"
        @stop-export="handleStopExport"
      />
    </main>

    <!-- 隐藏的手写字体文件选择框 -->
    <input
      ref="fontFileInputRef"
      class="score-notice-page__font-file-input"
      type="file"
      accept=".ttf,.otf,font/ttf,font/otf"
      @change="handleHandwriteFontChange"
    />

    <score-notice-import-dialog
      v-model="importDialogVisible"
      :system-students="dataStore.enabledData"
      @confirm="handleImportConfirm"
    />

    <!-- 离屏导出预览：批量导出时逐名学生渲染报告 -->
    <div class="score-notice-page__offscreen" aria-hidden="true">
      <score-notice-preview
        ref="exportPreviewRef"
        :title="exportContext?.title ?? store.title"
        :notice-date="exportContext?.noticeDate ?? store.noticeDate"
        :mode="exportContext?.mode ?? store.mode"
        :subjects="exportContext?.subjects ?? store.subjects"
        :student="exportStudent"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.score-notice-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.score-notice-page__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  flex: 1;
  min-height: 0;
  gap: 16px;
  overflow: hidden;
}
.score-notice-page__offscreen {
  position: fixed;
  top: 0;
  left: -20000px;
  width: 1448px;
  pointer-events: none;
}
.score-notice-page__font-file-input {
  display: none;
}
@media (max-width: 1180px) {
  .score-notice-page__workspace {
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 12px;
  }
}
</style>
