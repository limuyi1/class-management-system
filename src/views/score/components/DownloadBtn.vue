<script setup lang="ts">
import * as XLSX from 'xlsx'
import { storeToRefs } from 'pinia'

import { exportExcel } from '@/utils/xlsxUntil'
import { passingScoreRanges } from '@/config/score'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'

const store = useDataSourceStore()
const configuration = useConfigurationStore()

const { data: originList } = storeToRefs(store)
const { data: config } = storeToRefs(configuration)

/**
 * 分数分布区间配置（合并及格区间和低分区间）
 */
const scoreRanges = [...passingScoreRanges, { label: '60分以下', min: 0, max: 59 }]

/**
 * 获取当前选中列的分数值
 */
const getScore = (item: any): number | null => {
  if (!config.value.inputScoreTab) return null
  return item[config.value.inputScoreTab]
}

/**
 * 按分数区间筛选并排序数据
 */
const filterByRange = (range: { min: number; max: number }) => {
  return originList.value
    .filter((e: any) => {
      const score = getScore(e)
      return score !== null && score >= range.min && score <= range.max
    })
    .sort((a: any, b: any) => (getScore(b) || 0) - (getScore(a) || 0))
}

/**
 * 生成统计数据
 */
const createStatistics = () => {
  const scores = originList.value
    .map((e: any) => getScore(e))
    .filter((s): s is number => s !== null && !isNaN(s))

  const avg =
    scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '0.00'
  const passCount = scores.filter((s) => s >= 60).length
  const passRate = scores.length > 0 ? ((passCount / scores.length) * 100).toFixed(2) : '0.00'
  const excellentCount = scores.filter((s) => s >= 80).length
  const excellentRate =
    scores.length > 0 ? ((excellentCount / scores.length) * 100).toFixed(2) : '0.00'

  return { avg, passRate, excellentRate }
}

/**
 * 导出 Excel
 */
const exportExcelFun = () => {
  const workbook = XLSX.utils.book_new()

  // 生成总表 sheet（含统计）- 放在第一个
  const header = ['序号', '姓名', '分数']
  const body = originList.value.map((e: any, i: number) => {
    const score = getScore(e)
    return [String(i + 1), e.xing4_ming2, score !== null ? Number(score) : '']
  })
  const stats = createStatistics()
  const footer = [
    ['平均分', null, Number(stats.avg)],
    ['及格率', null, `${stats.passRate}%`],
    ['优秀率', null, `${stats.excellentRate}%`]
  ]

  const mergeStartIndex = body.length + 1
  const merges = footer.map((_, i) => ({
    s: { r: mergeStartIndex + i, c: 0 },
    e: { r: mergeStartIndex + i, c: 1 }
  }))

  const mainSheet = XLSX.utils.aoa_to_sheet([header, ...body, ...footer])
  mainSheet['!merges'] = merges
  XLSX.utils.book_append_sheet(workbook, mainSheet, '总表')

  // 生成各分数区间的 sheet
  scoreRanges.forEach((range) => {
    const data = filterByRange(range)
    const rangeBody = data.map((e: any, i: number) => {
      const score = getScore(e)
      return [String(i + 1), e.xing4_ming2, score !== null ? Number(score) : '']
    })
    const sheet = XLSX.utils.aoa_to_sheet([['序号', '姓名', '分数'], ...rangeBody])
    XLSX.utils.book_append_sheet(workbook, sheet, range.label)
  })

  exportExcel(undefined, undefined, `成绩_${new Date().toLocaleString()}.xlsx`, workbook)
}
</script>

<template>
  <el-tooltip content="下载成绩" placement="top">
    <el-button size="small" circle @click="exportExcelFun">
      <template #icon><font-awesome-icon :icon="['solid', 'download']" /></template>
    </el-button>
  </el-tooltip>
</template>

<style scoped lang="scss"></style>
