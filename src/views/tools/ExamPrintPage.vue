<script setup lang="ts">
/** 单次测评打印稿：读取本期原始分数，不混入历史参照列。 */
import { computed, ref, watch } from 'vue'

import { useRouter } from 'vue-router'

import PrintWorkbenchLayout from '@/components/print-workbench/PrintWorkbenchLayout.vue'
import PrintPreviewViewport from '@/components/print-workbench/PrintPreviewViewport.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { useWorkspaceStore } from '@/stores/workspace'
import { buildExamPrintAnalysis, paginateExamPrint } from '@/utils/examPrintUtil'
import ExamPaper from './components/exam/ExamPaper.vue'
import PrintProductPreview from '@/components/print-workbench/PrintProductPreview.vue'
import { freezePrintData } from '@/utils/printDomUtil'
import { renderPrintPaperBlob } from '@/utils/printPaperExportUtil'
import { usePrintPageExport } from './composables/usePrintPageExport'

const router = useRouter()
const data = useDataSourceStore()
const settings = useSettingStore()
const config = useConfigurationStore()
const workspace = useWorkspaceStore()
const columns = computed(() =>
  settings.enabledScoreColumns.filter((column) => column.prop !== 'name' && !column.reference)
)
const selectedProp = ref('')
const includeStudents = ref(false)
const page = ref(1)
watch(
  columns,
  (items) => {
    if (!items.some((item) => item.prop === selectedProp.value))
      selectedProp.value = items[items.length - 1]?.prop || ''
  },
  { immediate: true }
)
const selectedColumn = computed(() =>
  columns.value.find((column) => column.prop === selectedProp.value)
)
const title = computed(() => `${selectedColumn.value?.label || '考试'}分析表`)
const subtitle = computed(
  () => `${workspace.activePeriod?.className || ''}    ${workspace.activePeriod?.termName || ''}`
)
const analysis = computed(() =>
  buildExamPrintAnalysis(
    data.enabledData,
    selectedProp.value,
    selectedColumn.value?.fullMark ?? config.scoreFullMark
  )
)
const pages = computed(() =>
  selectedColumn.value ? paginateExamPrint(analysis.value, includeStudents.value) : []
)
const current = computed(() => pages.value[page.value - 1])
const productVisible = ref(false)
const { busy, stopped, progress, total, errors, exportPages } = usePrintPageExport()
watch(pages, () => {
  page.value = Math.max(1, Math.min(page.value, pages.value.length))
})

/** 导出时冻结统计、页模型及标题，所有页面使用同一 DOM 组件。 */
async function exportPdf(): Promise<void> {
  const snapshot = freezePrintData({
    pages: pages.value,
    analysis: analysis.value,
    title: title.value,
    subtitle: subtitle.value
  })
  await exportPages(
    snapshot.pages.map(
      (page: (typeof pages.value)[number]) => () =>
        renderPrintPaperBlob(ExamPaper, {
          analysis: snapshot.analysis,
          title: snapshot.title,
          subtitle: snapshot.subtitle,
          page
        })
    ),
    snapshot.title,
    { width: 210, height: 297 }
  )
}
async function createPreviewImage(): Promise<Blob> {
  return renderPrintPaperBlob(
    ExamPaper,
    freezePrintData({
      page: current.value,
      analysis: analysis.value,
      title: title.value,
      subtitle: subtitle.value
    })
  )
}
</script>

<template>
  <PrintWorkbenchLayout
    ><template #header>
      <PageHeader
        :icon="['solid', 'chart-line']"
        title="考试分析打印稿"
        subtitle="单次测评统计、分数分布与可选学生明细"
      >
        <template #left
          ><el-button circle aria-label="返回工具" @click="router.push('/tools')"
            >←</el-button
          ></template
        >
      </PageHeader> </template
    ><template #sidebar
      ><el-card shadow="never"
        ><el-form label-position="top" :disabled="busy"
          ><el-form-item label="本期测评">
            <el-select v-model="selectedProp" placeholder="选择本期测评" style="width: 240px"
              ><el-option
                v-for="column in columns"
                :key="column.prop"
                :value="column.prop"
                :label="column.label"
            /></el-select> </el-form-item
          ><el-checkbox v-model="includeStudents">附学生成绩明细</el-checkbox></el-form
        ></el-card
      ><el-alert
        v-if="errors.length"
        type="error"
        :closable="false"
        :title="errors.join('；')" /></template
    ><PrintPreviewViewport :width="1260" fit-width
      ><template #navigation
        ><el-pagination
          v-model:current-page="page"
          :disabled="busy"
          :page-count="pages.length || 1"
          layout="prev, next"
        /><span>{{ page }} / {{ pages.length || 1 }} 页</span></template
      ><ExamPaper
        v-if="current"
        :page="current"
        :analysis="analysis"
        :title="title"
        :subtitle="subtitle" /><el-empty
        v-else
        description="请先配置本期测评" /></PrintPreviewViewport
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
        :width="1260"
        :version="JSON.stringify([current, analysis, title, subtitle])"
        :create-image="createPreviewImage"
        ><ExamPaper
          v-if="current"
          :page="current"
          :analysis="analysis"
          :title="title"
          :subtitle="subtitle" /></PrintProductPreview
    ></template>
  </PrintWorkbenchLayout>
</template>
