<script setup lang="ts">
import * as XLSX from 'xlsx'
import { storeToRefs } from 'pinia'

import { exportExcel } from '@/utils/xlsxUntil'
import { passingScoreRanges } from '@/config/score'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { dayjs, ElLoading, ElMessage } from 'element-plus'
import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false
})

const store = useDataSourceStore()
const configuration = useConfigurationStore()
const settingStore = useSettingStore()

const { items: originList } = storeToRefs(store)
const { tableHeaders } = storeToRefs(settingStore)

const scoreRanges = [...passingScoreRanges, { label: '60分以下', min: 0, max: 59 }]
type CellValueType = string | number | null

const exportWorkbook = (fileName: string, workbook: XLSX.WorkBook) => {
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出Excel...'
  })

  try {
    const result = exportExcel(undefined, undefined, fileName, workbook)
    if (!result.success) {
      ElMessage.error(result.error?.message || '导出Excel失败')
      return
    }
    ElMessage.success('导出成功')
  } finally {
    loading.close()
  }
}

const getScore = (item: StudentDataType): number | null => {
  if (!configuration.inputScoreTab) return null
  const score = item[configuration.inputScoreTab]
  return typeof score === 'number' && Number.isFinite(score) ? score : null
}

const filterByRange = (range: { min: number; max: number }) => {
  return originList.value
    .filter((e) => {
      const score = getScore(e)
      return score !== null && score >= range.min && score <= range.max
    })
    .sort((a, b) => (getScore(b) || 0) - (getScore(a) || 0))
}

const buildSheetWithStats = (
  sheetName: string,
  filename: string,
  scoreLabels: string[],
  buildScoreRow: (item: StudentDataType) => CellValueType[],
  footerRows: CellValueType[][]
) => {
  const workbook = XLSX.utils.book_new()
  const header = ['序号', '姓名', ...scoreLabels]
  const body = originList.value.map((e, i: number) => [
    String(i + 1),
    e[NAME_PROP],
    ...buildScoreRow(e)
  ])

  const merges = footerRows.map((_, i) => ({
    s: { r: body.length + 1 + i, c: 0 },
    e: { r: body.length + 1 + i, c: 1 }
  }))

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body, ...footerRows])
  sheet['!merges'] = merges
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  exportWorkbook(filename, workbook)
}

const exportExcelFun = () => {
  const workbook = XLSX.utils.book_new()
  const filename = `成绩_${dayjs().format('YYYY-MM-DD_HH:mm:ss')}.xlsx`

  const footer: CellValueType[][] = [
    ['平均分', null, Number(store.average.toFixed(2))],
    ['及格率', null, `${store.passRate.toFixed(2)}%`],
    ['优秀率', null, `${store.excellentRate.toFixed(2)}%`]
  ]
  const header = ['序号', '姓名', '分数']
  const body = originList.value.map((e, i: number) => {
    const score = getScore(e)
    return [String(i + 1), e[NAME_PROP], score !== null ? Number(score) : '']
  })
  const merges = footer.map((_, i) => ({
    s: { r: body.length + 1 + i, c: 0 },
    e: { r: body.length + 1 + i, c: 1 }
  }))
  const mainSheet = XLSX.utils.aoa_to_sheet([header, ...body, ...footer])
  mainSheet['!merges'] = merges
  XLSX.utils.book_append_sheet(workbook, mainSheet, '总表')

  scoreRanges.forEach((range) => {
    const data = filterByRange(range)
    const rangeBody = data.map((e, i: number) => {
      const score = getScore(e)
      return [String(i + 1), e[NAME_PROP], score !== null ? Number(score) : '']
    })
    const sheet = XLSX.utils.aoa_to_sheet([['序号', '姓名', '分数'], ...rangeBody])
    XLSX.utils.book_append_sheet(workbook, sheet, range.label)
  })

  exportWorkbook(filename, workbook)
}

const exportAllExcelFun = () => {
  const unitHeaders = tableHeaders.value.filter((h) => h.prop !== NAME_PROP)
  const scoreLabels = unitHeaders.map((h) => h.label)

  const unitAverages = unitHeaders.map((h) => {
    const scores = originList.value
      .map((e) => e[h.prop])
      .filter((s) => s !== null && s !== undefined) as number[]
    if (scores.length === 0) return ''
    return (scores.reduce((acc, cur) => acc + cur, 0) / scores.length).toFixed(2)
  })

  const footer = [['平均分', null, ...unitAverages.map((avg) => (avg === '' ? '' : Number(avg)))]]

  buildSheetWithStats(
    '成绩汇总',
    `成绩汇总_${dayjs().format('YYYY-MM-DD_HH:mm:ss')}.xlsx`,
    scoreLabels,
    (item) =>
      unitHeaders.map((h) =>
        item[h.prop] !== null && item[h.prop] !== undefined ? Number(item[h.prop]) : ''
      ),
    footer
  )
}

const handleCommand = (command: 'current' | 'all') => {
  if (command === 'current') {
    exportExcelFun()
  } else {
    exportAllExcelFun()
  }
}
</script>

<template>
  <el-dropdown @command="handleCommand" trigger="hover">
    <el-button :disabled="disabled">
      <template #icon><font-awesome-icon :icon="['solid', 'download']" /></template>
      导出总表
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="current">下载当前成绩</el-dropdown-item>
        <el-dropdown-item command="all">下载所有成绩</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
