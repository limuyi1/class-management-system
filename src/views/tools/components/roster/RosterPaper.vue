<script setup lang="ts">
import { computed } from 'vue'

import PrintPaperFrame from '@/components/print-workbench/PrintPaperFrame.vue'
import { RosterTemplateEnum } from '@/types/PrintTools'

import type { RosterPrintPageType, RosterPrintSettingsType } from '@/types/PrintTools'

const props = defineProps<{
  page: RosterPrintPageType
  settings: RosterPrintSettingsType
  count: number
}>()
const headings = computed(() => [
  '序号',
  '姓名',
  ...(props.settings.template === RosterTemplateEnum.Compact ? [] : props.settings.columns),
  ...(props.settings.remarks ? ['备注'] : [])
])
const widths = computed(() => {
  const width =
    (props.page.width - 24 - (props.page.groups.length - 1) * 6) / props.page.groups.length
  const extra = props.settings.template === RosterTemplateEnum.Compact ? [] : props.settings.columns
  if (extra.length)
    return [
      12,
      30,
      ...extra.map(() => (width - 42 - (props.settings.remarks ? 28 : 0)) / extra.length),
      ...(props.settings.remarks ? [28] : [])
    ]
  return props.settings.remarks ? [12, (width - 12) * 0.52, (width - 12) * 0.48] : [12, width - 12]
})
</script>
<template>
  <PrintPaperFrame
    :width="page.width"
    :height="page.height"
    :title="settings.title"
    :subtitle="settings.subtitle"
    :footer="`共 ${count} 人  第 ${page.page} / ${page.pageCount} 页`"
  >
    <div class="roster-paper__tables">
      <div v-for="(students, group) in page.groups" :key="group" class="roster-paper__group">
        <table v-if="students.length" :style="{ '--row-height': `${settings.rowHeight * 6}px` }">
          <colgroup>
            <col
              v-for="(width, index) in widths"
              :key="index"
              :style="{ width: `${width * 6}px` }"
            />
          </colgroup>
          <thead>
            <tr>
              <th v-for="(heading, index) in headings" :key="index">{{ heading }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.number">
              <td>{{ student.number }}</td>
              <td>{{ student.name }}</td>
              <td v-for="index in headings.length - 2" :key="index"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </PrintPaperFrame>
</template>
<style scoped lang="scss">
.roster-paper__tables {
  display: flex;
  gap: 36px;
  align-items: flex-start;
}
.roster-paper__group {
  flex: 1;
  min-width: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 21px;
}
th,
td {
  border: 1px solid #666;
  padding: 0 6px;
  text-align: center;
  vertical-align: middle;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
th {
  height: 66px;
  font-size: 19px;
  background: #eee;
  white-space: pre-wrap;
  font-weight: 400;
}
td {
  box-sizing: border-box;
  height: var(--row-height);
}
</style>
