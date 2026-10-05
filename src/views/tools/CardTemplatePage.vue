<script setup lang="ts">
import { ref } from 'vue'

import PrintWorkbenchLayout from '@/components/print-workbench/PrintWorkbenchLayout.vue'
import PrintPreviewViewport from '@/components/print-workbench/PrintPreviewViewport.vue'
import PrintProductPreview from '@/components/print-workbench/PrintProductPreview.vue'
import PageHeader from '@/components/PageHeader.vue'
import CardStudentDialog from './components/cards/CardStudentDialog.vue'
import ScoreNoticePreview from '@/views/score-notice/components/ScoreNoticePreview.vue'
import AttachmentSelectorDialog from '@/views/tools/components/AttachmentSelectorDialog.vue'
import CardCanvas from './components/cards/CardCanvas.vue'
import CardPaper from './components/cards/CardPaper.vue'
import CardExportActions from './components/cards/CardExportActions.vue'
import CardTemplatePicker from './components/cards/CardTemplatePicker.vue'
import CardContentPanel from './components/cards/CardContentPanel.vue'
import CardAdvancedSettings from './components/cards/CardAdvancedSettings.vue'
import { useCardWorkbench } from './composables/useCardWorkbench'

const props = withDefaults(
  defineProps<{ embedded?: boolean; initialPreset?: 'certificate' | 'card' | 'blank' }>(),
  { embedded: false, initialPreset: 'certificate' }
)
const {
  router,
  advancedEditing,
  productVisible,
  productVersion,
  createPreviewImage,
  handleAddText,
  tools,
  template,
  selectedLayerId,
  saving,
  dirty,
  fileInput,
  libraryVisible,
  students,
  previewIndex,
  globals,
  converting,
  capturePreview,
  fixture,
  noticeStudents,
  handleConvertNotice,
  chooseTemplate,
  saveCurrentTemplate,
  currentStudent,
  fields,
  fieldNames,
  busy,
  cancelled,
  progress,
  total,
  errors,
  fourUp,
  exportBatch,
  openMaterial,
  deleteTemplate,
  upload,
  useAttachments,
  reorderLayer
} = useCardWorkbench(props.initialPreset)
const studentsVisible = ref(false)
</script>
<template>
  <PrintWorkbenchLayout
    :embedded="embedded"
    sidebar-width="clamp(340px, 32vw, 400px)"
    :sidebar-mode="advancedEditing"
  >
    <template v-if="!embedded" #header
      ><PageHeader
        :icon="['solid', 'file-signature']"
        title="通知与奖状"
        subtitle="上传素材，编辑文字与版式，逐人预览"
        ><template #left
          ><el-button circle aria-label="返回工具" @click="router.push('/tools')"
            >←</el-button
          ></template
        ></PageHeader
      ></template
    >
    <template #toolbar>
      <div class="card-tool__toolbar">
        <CardTemplatePicker
          :template="template"
          :saved="tools.cardTemplates"
          :busy="busy || converting || saving"
          :converting="converting"
          @choose="chooseTemplate"
          @convert="handleConvertNotice"
        />
        <div class="card-tool__toolbar-actions">
          <el-button :disabled="busy || converting || saving" @click="studentsVisible = true">
            选择学生<span v-if="students.length">（{{ students.length }} 人）</span>
          </el-button>
          <el-button
            :disabled="busy || converting || saving"
            :type="advancedEditing ? 'primary' : 'default'"
            plain
            @click="advancedEditing = !advancedEditing"
          >
            {{ advancedEditing ? '返回填写内容' : '高级编辑' }}
          </el-button>
        </div>
      </div>
    </template>
    <template #sidebar>
      <CardContentPanel
        v-if="!advancedEditing"
        v-model:globals="globals"
        :template="template"
        :busy="busy || converting || saving"
        :student-fields="students.flatMap((student) => Object.keys(student.fields))"
      />
      <CardAdvancedSettings
        v-else
        v-model:template="template"
        v-model:globals="globals"
        v-model:selected-layer-id="selectedLayerId"
        :busy="busy || converting || saving"
        :field-names="fieldNames"
        :saved="tools.cardTemplates.some((item) => item.id === template.id)"
        @choose="chooseTemplate"
        @material="openMaterial"
        @add-text="handleAddText"
        @reorder="reorderLayer"
        @save-copy="saveCurrentTemplate(true)"
        @delete="deleteTemplate"
      />
      <el-progress v-if="total" :percentage="Math.round((progress / total) * 100)" />
      <el-alert
        v-if="errors.length"
        type="error"
        :closable="false"
        title="以下卡片未导出，请修正后重试"
        ><p v-for="error in errors" :key="error">{{ error }}</p></el-alert
      >
    </template>
    <PrintPreviewViewport :width="template.width * 6">
      <template #navigation
        ><el-pagination
          v-model:current-page="previewIndex"
          :page-count="students.length || 1"
          :disabled="busy"
          layout="prev, next"
        /><span
          >{{ currentStudent?.name || '示例预览' }} · {{ previewIndex }} /
          {{ students.length || 1 }}</span
        ></template
      >
      <CardCanvas
        v-model="selectedLayerId"
        :template="template"
        :fields="fields"
        :busy="busy || converting || saving"
        :editing="advancedEditing"
      />
    </PrintPreviewViewport>
    <template #actions>
      <CardExportActions
        v-model:four-up="fourUp"
        :disabled="busy || converting || saving"
        :busy="busy"
        :saving="saving"
        :dirty="dirty"
        :has-students="!!students.length"
        @preview="productVisible = true"
        @save="saveCurrentTemplate()"
        @export="exportBatch"
        @stop="cancelled = true"
      />
    </template>
    <template #outside>
      <CardStudentDialog
        v-model:visible="studentsVisible"
        v-model:students="students"
        :notice-students="noticeStudents"
        :prefer-notice="!!template.scene"
        :busy="busy || converting || saving"
      />
      <PrintProductPreview
        v-model="productVisible"
        :width="template.width * 6"
        :version="String(productVersion)"
        :image-scale="template.scene ? 2 : 1"
        :create-image="createPreviewImage"
      >
        <CardPaper :template="template" :fields="fields" />
      </PrintProductPreview>
      <div v-if="converting" class="card-tool__capture" aria-hidden="true">
        <ScoreNoticePreview ref="capturePreview" v-bind="fixture" />
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        @change="upload"
      />
      <AttachmentSelectorDialog
        v-model:visible="libraryVisible"
        @confirm="useAttachments"
        @add-attachments="router.push('/tools/attachments')"
      />
    </template>
  </PrintWorkbenchLayout>
</template>
<style scoped lang="scss">
.card-tool__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);
}
.card-tool__toolbar-actions {
  display: flex;
  gap: 12px;
  flex: none;
}
.card-tool__toolbar-actions :deep(.el-button) {
  margin-left: 0;
}
.card-tool__capture {
  position: fixed;
  left: -20000px;
  top: 0;
  width: 1448px;
  pointer-events: none;
}
@media (max-width: 1000px) {
  .card-tool__toolbar {
    flex-wrap: wrap;
  }
}
</style>
