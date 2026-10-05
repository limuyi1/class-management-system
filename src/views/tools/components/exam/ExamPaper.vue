<script setup lang="ts">
import PrintPaperFrame from '@/components/print-workbench/PrintPaperFrame.vue'
import ExamSummary from './ExamSummary.vue'

import type { ExamPrintAnalysisType, ExamPrintPageType } from '@/types/ExamPrint'
defineProps<{
  page: ExamPrintPageType
  analysis: ExamPrintAnalysisType
  title: string
  subtitle: string
}>()
</script>
<template>
  <PrintPaperFrame
    :title="`${title}${page.kind === 'students' ? ' · 学生明细' : ''}`"
    :subtitle="subtitle"
    :footer="`${page.page} / ${page.pageCount}`"
  >
    <ExamSummary v-if="page.kind === 'summary'" :analysis="analysis" />
    <table v-else class="exam-paper__table">
      <colgroup>
        <col style="width: 9%" />
        <col style="width: 31%" />
        <col style="width: 22%" />
        <col style="width: 38%" />
      </colgroup>
      <thead>
        <tr>
          <th>序号</th>
          <th>姓名</th>
          <th>分数 / {{ analysis.fullMark }}</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="student in page.rows" :key="student.number">
          <td>{{ student.number }}</td>
          <td>{{ student.name }}</td>
          <td>{{ student.score === null ? '无有效成绩' : student.score }}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </PrintPaperFrame>
</template>
<style scoped lang="scss">
.exam-paper__table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  font-size: 21px;
}
th,
td {
  box-sizing: border-box;
  border: 1px solid #777;
  padding: 0 6px;
  height: 48px;
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
}
th {
  background: #eee;
  font-weight: 400;
}
</style>
