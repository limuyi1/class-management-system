import { ElMessage } from 'element-plus'
import domtoimage from 'dom-to-image'
import type { ComputedRef, Ref } from 'vue'

import { NAME_PROP } from '@/types/Constants'
import type { ScoreStatisticsType, ScoreStudentType } from '@/hooks/useScoreStatistics'

interface UseScoreDistributionActionsOptions {
  scoreStats: ComputedRef<ScoreStatisticsType | null>
  belowThresholdStudents: ComputedRef<ScoreStudentType[]>
  threshold: Ref<number> | ComputedRef<number>
  title?: Ref<string> | ComputedRef<string>
  getScore: (item: ScoreStudentType) => number | null
}

export function useScoreDistributionActions(options: UseScoreDistributionActionsOptions) {
  const { scoreStats, belowThresholdStudents, threshold, title, getScore } = options

  const copyToClipboard = () => {
    if (!scoreStats.value) return

    const { maxScore, maxScoreCount, topStudents, ranges, lowScoreRanges, avgScore, totalCount } =
      scoreStats.value

    let text = `${title?.value || '成绩分布统计'}（共${totalCount}人）\n`
    text += `最高分：${maxScore}分（${maxScoreCount}人）${topStudents.join('、')}\n`
    text += `平均分：${avgScore}分\n`

    ranges.forEach((range) => {
      text += `${range.label}：${range.count}人\n`
    })

    lowScoreRanges.forEach((range) => {
      text += `${range.label}：${range.count}人\n`
    })

    navigator.clipboard
      .writeText(text)
      .then(() => {
        ElMessage.success('复制成功！')
      })
      .catch(() => {
        ElMessage.error('复制失败')
      })
  }

  const downloadImage = (mode: 'withScore' | 'nameOnly') => {
    const students = [...belowThresholdStudents.value].sort(
      (a, b) => (getScore(b) || 0) - (getScore(a) || 0)
    )

    if (students.length === 0) {
      ElMessage.warning('暂无学生数据')
      return
    }

    const headerHtml =
      mode === 'withScore'
        ? '<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;">姓名</th><th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;">分数</th>'
        : '<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;">姓名</th>'

    const bodyHtml = students
      .map((student) => {
        const row = `<td style="border:1px solid #ddd;padding:8px;text-align:center;">${student[NAME_PROP]}</td>`
        const scoreRow =
          mode === 'withScore'
            ? `<td style="border:1px solid #ddd;padding:8px;text-align:center;">${getScore(student)}分</td>`
            : ''
        return `<tr>${row}${scoreRow}</tr>`
      })
      .join('')

    const html = `
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `

    const container = document.createElement('div')
    container.innerHTML = html
    container.style.padding = '20px'
    container.style.background = '#fff'
    container.style.position = 'absolute'
    container.style.top = '0'
    container.style.left = '0'
    container.style.zIndex = '-1000'
    document.body.appendChild(container)

    domtoimage
      .toJpeg(container, { quality: 1, bgcolor: '#fff' })
      .then((dataUrl: string) => {
        const link = document.createElement('a')
        link.download = `低分学生_${threshold.value}分.jpg`
        link.href = dataUrl
        link.click()
        ElMessage.success('下载成功')
      })
      .catch(() => {
        ElMessage.error('下载失败')
      })
      .finally(() => {
        container.remove()
      })
  }

  return {
    copyToClipboard,
    downloadImage
  }
}
