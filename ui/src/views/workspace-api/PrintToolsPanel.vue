<script setup lang="ts">
import { useApiPrintTools } from '@/hooks/api/useApiPrintTools'
import { createRosterSettings, ROSTER_TEMPLATES } from '@/utils/rosterPrintUtil'
const props = defineProps<{ ownerId: string; workspaceId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
const {
  kind,
  selected,
  settings,
  columnText,
  title,
  body,
  comparison,
  externalBaseline,
  external,
  result,
  busy,
  students,
  hasDraft,
  reset,
  run,
  exportPdf,
  compare,
  assessmentId,
  snapshot,
  templates,
  templateId,
  exporter
} = useApiPrintTools(props, (value) => emit('busy', value))
defineExpose({ hasDraft, reset })
</script>
<template>
  <section>
    <el-select v-model="kind" :disabled="busy"
      ><el-option value="roster" label="名单打印" /><el-option
        value="exam"
        label="测评分析打印" /><el-option value="certificate" label="批量奖状" /><el-option
        value="card"
        label="表扬卡" /><el-option value="compare" label="名单核对"
    /></el-select>
    <template v-if="kind === 'compare'"
      ><el-checkbox v-model="external" :disabled="busy">比较两份外部名单</el-checkbox
      ><el-input
        v-if="external"
        v-model="externalBaseline"
        type="textarea"
        :rows="6"
        placeholder="基准名单，每行一人"
      /><el-input
        v-model="comparison"
        type="textarea"
        :rows="6"
        placeholder="对照名单，每行一人"
      /><el-button :disabled="busy" @click="run(compare)">核对</el-button
      ><template v-if="result"
        ><p>匹配 {{ result.matched.length }} 人</p>
        <p>仅基准有：{{ result.baselineOnly.join('、') || '无' }}</p>
        <p>仅对照有：{{ result.comparisonOnly.join('、') || '无' }}</p></template
      ></template
    >
    <template v-else
      ><el-select v-model="selected" multiple filterable :disabled="busy" placeholder="选择打印学生"
        ><el-option v-for="row in students" :key="row.id" :value="row.id" :label="row.name"
      /></el-select>
      <template v-if="kind === 'roster'"
        ><el-select
          v-model="settings.template"
          :disabled="busy"
          @change="settings = createRosterSettings(settings.template, settings.subtitle)"
          ><el-option
            v-for="item in ROSTER_TEMPLATES"
            :key="item.value"
            :value="item.value"
            :label="item.label" /></el-select
        ><el-input v-model="settings.title" placeholder="打印标题" :disabled="busy" /><el-input
          v-model="columnText"
          placeholder="事项列，用英文逗号分隔"
          :disabled="busy"
      /></template>
      <el-select v-else-if="kind === 'exam'" v-model="assessmentId" :disabled="busy"
        ><el-option
          v-for="unit in snapshot?.scores.assessments.filter((row) => !row.disabled)"
          :key="unit.id"
          :value="unit.id"
          :label="unit.label"
      /></el-select>
      <template v-else
        ><el-select
          v-model="templateId"
          clearable
          :disabled="busy"
          placeholder="内置模板或已保存模板"
          ><el-option
            v-for="item in templates"
            :key="item.id"
            :value="item.id"
            :label="item.name" /></el-select
        ><el-input v-model="title" placeholder="荣誉称号" :disabled="busy" /><el-input
          v-model="body"
          type="textarea"
          :rows="4"
          placeholder="正文"
          :disabled="busy"
      /></template>
      <el-button :loading="busy" @click="run(exportPdf)">导出 PDF</el-button
      ><el-button v-if="busy" @click="exporter.stopped.value = true">停止</el-button>
      <p v-if="busy">
        已完成 {{ exporter.progress.value }} / {{ exporter.total.value }} 页
      </p> </template
    ><el-button :disabled="busy" @click="reset">清除临时版式</el-button>
  </section>
</template>
<style scoped lang="scss">
section {
  display: grid;
  gap: 12px;
}
.el-select {
  max-width: 720px;
}
</style>
