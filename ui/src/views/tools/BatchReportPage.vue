<script setup lang="ts">
/** 学习报告批量工作台：选择范围、编辑正文、预览并下载。 */
import PrintWorkbenchLayout from '@/components/print-workbench/PrintWorkbenchLayout.vue'
import PrintPreviewViewport from '@/components/print-workbench/PrintPreviewViewport.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrintStudentPicker from '@/components/student-source/PrintStudentPicker.vue'
import StudentReportPreviewCard from '@/components/student-report/StudentReportPreviewCard.vue'
import { useBatchReports } from './composables/useBatchReports'

const {
  router,
  projection,
  aiConfigured,
  students,
  selectedProps,
  selectedId,
  useAI,
  busy,
  saving,
  stopped,
  progress,
  total,
  errorIds,
  exportNode,
  exportJob,
  completed,
  jobSnapshot,
  drafts,
  jobs,
  current,
  generate,
  download
} = useBatchReports()
</script>

<template>
  <PrintWorkbenchLayout>
    <template #header>
      <PageHeader
        :icon="['solid', 'file-lines']"
        title="批量学习报告"
        subtitle="统一选择成绩范围，批量生成学生报告"
      >
        <template #left
          ><el-button circle aria-label="返回工具" @click="router.push('/tools')"
            >←</el-button
          ></template
        >
      </PageHeader>
    </template>
    <template #sidebar>
      <el-card shadow="never"
        ><PrintStudentPicker v-model="students" system-only :disabled="busy"
      /></el-card>
      <el-card shadow="never">
        <el-select
          v-model="selectedProps"
          multiple
          :disabled="busy"
          placeholder="选择成绩范围"
          style="width: 100%"
          ><el-option
            v-for="header in projection.normalizedHeaders"
            :key="header.prop"
            :value="header.prop"
            :label="`${header.label}${header.reference ? '（历史参照）' : ''}`"
        /></el-select>
        <el-checkbox v-model="useAI" :disabled="busy || !aiConfigured"
          >使用 AI 生成正文（{{ jobs.length }} 次请求）</el-checkbox
        >
        <p>
          已选 {{ students.length }} 人，{{ students.length - jobs.length }}
          人在所选范围无成绩，将跳过。PDF 每名学生从新页开始，长报告自动续页，完整保留正文。
        </p>
        <el-progress v-if="total" :percentage="Math.round((progress / total) * 100)" />
        <el-alert
          v-if="errorIds.length"
          type="warning"
          :closable="false"
          :title="`生成失败：${jobSnapshot
            .filter((job) => errorIds.includes(job.id))
            .map((job) => job.report.studentName)
            .join('、')}`"
        />
      </el-card>
      <div v-if="current">
        <el-card shadow="never"
          ><el-input
            :model-value="current.content"
            type="textarea"
            :autosize="{ minRows: 12 }"
            :disabled="busy"
            @update:model-value="drafts[selectedId] = $event"
        /></el-card></div
    ></template>
    <PrintPreviewViewport :width="1120" fit-width
      ><template #navigation
        ><el-select v-model="selectedId" :disabled="busy" aria-label="预览学生" style="width: 160px"
          ><el-option
            v-for="job in jobs"
            :key="job.id"
            :value="job.id"
            :label="job.report.studentName" /></el-select></template
      ><StudentReportPreviewCard
        v-if="current"
        :report="current.report"
        :content="current.content"
        static-rendering /><el-empty v-else description="选择学生和有效成绩后预览报告"
    /></PrintPreviewViewport>
    <template #actions>
      <div class="batch-report__actions">
        <el-button
          type="primary"
          :disabled="!jobs.length || busy || saving"
          @click="generate(false)"
          >生成 {{ jobs.length }} 份报告</el-button
        >
        <el-button v-if="busy" @click="stopped = true">停止生成</el-button>
        <el-button v-if="jobSnapshot.length > completed.size && !busy" @click="generate(true)"
          >重试 / 继续未完成</el-button
        >
        <el-button :disabled="!completed.size || busy" :loading="saving" @click="download('zip')"
          >下载图片 ZIP（{{ completed.size }}）</el-button
        >
        <el-button :disabled="!completed.size || busy" :loading="saving" @click="download('pdf')"
          >下载合并 PDF</el-button
        >
      </div> </template
    ><template #outside>
      <div v-if="exportJob" ref="exportNode" class="batch-report__export">
        <StudentReportPreviewCard
          :key="exportJob.id"
          :report="exportJob.report"
          :content="exportJob.content"
          static-rendering
        /></div
    ></template>
  </PrintWorkbenchLayout>
</template>
<style scoped lang="scss">
p {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin: 12px 0;
}
.batch-report__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.batch-report__export {
  position: fixed;
  left: -20000px;
  top: 0;
  width: 1120px;
  pointer-events: none;
}
</style>
