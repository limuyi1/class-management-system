<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useRouter } from 'vue-router'

import PrintWorkbenchLayout from '@/components/print-workbench/PrintWorkbenchLayout.vue'
import PrintPreviewViewport from '@/components/print-workbench/PrintPreviewViewport.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrintStudentPicker from '@/components/student-source/PrintStudentPicker.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { RosterTemplateEnum } from '@/types/PrintTools'
import { createRosterSettings, paginateRoster, ROSTER_TEMPLATES } from '@/utils/rosterPrintUtil'
import RosterPaper from './components/roster/RosterPaper.vue'
import PrintProductPreview from '@/components/print-workbench/PrintProductPreview.vue'
import { freezePrintData } from '@/utils/printDomUtil'
import { renderPrintPaperBlob } from '@/utils/printPaperExportUtil'
import { usePrintPageExport } from './composables/usePrintPageExport'

import type { PrintStudentType } from '@/types/PrintTools'

const router = useRouter()
const workspace = useWorkspaceStore()
const students = ref<PrintStudentType[]>([])
const subtitle =
  `${workspace.activePeriod?.className || ''}    ${workspace.activePeriod?.termName || ''}`.trim()
const settings = ref(createRosterSettings(RosterTemplateEnum.Compact, subtitle))
const pageNumber = ref(1)
const columnCount = ref(6)
const pages = computed(() => paginateRoster(students.value, settings.value))
const current = computed(() => pages.value[pageNumber.value - 1])
const productVisible = ref(false)
const { busy, stopped, progress, total, errors, exportPages } = usePrintPageExport()
watch(
  () => settings.value.template,
  (value) => {
    settings.value = createRosterSettings(value, settings.value.subtitle)
    columnCount.value = settings.value.columns.length
    pageNumber.value = 1
  }
)
watch(columnCount, (count) => {
  settings.value.columns = Array.from(
    { length: count },
    (_, index) => settings.value.columns[index] || ''
  )
})
watch(pages, () => {
  pageNumber.value = Math.max(1, Math.min(pageNumber.value, pages.value.length))
})

/** 冻结名单、版式和页序，逐页挂载与导出相同 DOM。 */
async function exportPdf(): Promise<void> {
  const snapshot = freezePrintData({
    pages: pages.value,
    settings: settings.value,
    count: students.value.length
  })
  await exportPages(
    snapshot.pages.map(
      (page: (typeof pages.value)[number]) => () =>
        renderPrintPaperBlob(RosterPaper, {
          page,
          settings: snapshot.settings,
          count: snapshot.count
        })
    ),
    snapshot.settings.title,
    snapshot.pages[0]
  )
}
/** 成品图片仅在明确点击按钮时生成。 */
async function createPreviewImage(): Promise<Blob> {
  const snapshot = freezePrintData({
    page: current.value,
    settings: settings.value,
    count: students.value.length
  })
  return renderPrintPaperBlob(RosterPaper, snapshot)
}
</script>

<template>
  <PrintWorkbenchLayout
    ><template #header>
      <PageHeader
        :icon="['solid', 'print']"
        title="名单打印"
        subtitle="选择模板，生成适合纸笔记录的班级表格"
      >
        <template #left
          ><el-button circle aria-label="返回工具" @click="router.push('/tools')"
            >←</el-button
          ></template
        >
      </PageHeader> </template
    ><template #sidebar
      ><el-card shadow="never"><PrintStudentPicker v-model="students" :disabled="busy" /></el-card>
      <el-card shadow="never">
        <el-form label-position="top" :disabled="busy">
          <el-form-item label="打印模板"
            ><el-select v-model="settings.template"
              ><el-option
                v-for="item in ROSTER_TEMPLATES"
                :key="item.value"
                :label="item.label"
                :value="item.value" /></el-select
          ></el-form-item>
          <el-form-item label="标题"
            ><el-input v-model="settings.title" maxlength="50"
          /></el-form-item>
          <el-form-item label="班级 / 学期 / 日期"
            ><el-input v-model="settings.subtitle" maxlength="100"
          /></el-form-item>
          <el-form-item label="纸张方向"
            ><el-switch v-model="settings.landscape" active-text="A4 横向" inactive-text="A4 纵向"
          /></el-form-item>
          <el-form-item label="行高（毫米）"
            ><el-input-number v-model="settings.rowHeight" :min="4" :max="15" :step="0.5"
          /></el-form-item>
          <el-checkbox :disabled="busy" v-model="settings.remarks">显示备注列</el-checkbox>
          <el-checkbox
            v-if="settings.template === RosterTemplateEnum.Compact"
            :disabled="busy"
            v-model="settings.doubleColumn"
            >左右双栏</el-checkbox
          >
          <template v-else>
            <el-form-item label="事项列数"
              ><el-input-number v-model="columnCount" :min="1" :max="10"
            /></el-form-item>
            <el-form-item label="列标题（可留空供手写）">
              <div class="roster-print__columns">
                <el-input
                  v-for="(_, index) in settings.columns"
                  :key="index"
                  v-model="settings.columns[index]"
                  :placeholder="`第 ${index + 1} 列`"
                  maxlength="24"
                />
              </div>
            </el-form-item>
          </template>
        </el-form> </el-card
      ><el-alert
        v-if="errors.length"
        type="error"
        :closable="false"
        :title="errors.join('；')"
      /> </template
    ><PrintPreviewViewport :width="(settings.landscape ? 297 : 210) * 6" fit-width
      ><template #navigation
        ><el-pagination
          v-model:current-page="pageNumber"
          :disabled="busy"
          :page-count="pages.length || 1"
          layout="prev, next"
        /><span
          >{{ pageNumber }} / {{ pages.length || 1 }} 页 · {{ students.length }} 人</span
        ></template
      ><RosterPaper
        v-if="current"
        :page="current"
        :settings="settings"
        :count="students.length" /><el-empty
        v-else
        description="选择学生，或导入 Excel 名单" /></PrintPreviewViewport
    ><template #actions
      ><el-button :disabled="busy || !current" @click="productVisible = true">成品预览</el-button
      ><el-button type="primary" :disabled="busy || !pages.length" @click="exportPdf"
        >下载 PDF / 打印</el-button
      ><el-button v-if="busy" @click="stopped = true">停止</el-button
      ><span v-if="total">{{ progress }} / {{ total }} 页</span></template
    >
    <template #outside
      ><PrintProductPreview
        v-model="productVisible"
        :width="(settings.landscape ? 297 : 210) * 6"
        :version="JSON.stringify([current, settings])"
        :create-image="createPreviewImage"
        ><RosterPaper
          v-if="current"
          :page="current"
          :settings="settings"
          :count="students.length" /></PrintProductPreview
    ></template>
  </PrintWorkbenchLayout>
</template>
<style scoped lang="scss">
.roster-print__columns {
  display: grid;
  gap: 8px;
  width: 100%;
}
</style>
