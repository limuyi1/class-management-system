import { ElMessage } from 'element-plus'
import { startLoading, stopLoading } from '@/hooks/useLoading'
import domtoimage from 'dom-to-image'
import type { ComputedRef, Ref } from 'vue'

import { NAME_PROP } from '@/constants'
import type { ScoreStatisticsType, ScoreStudentType } from '@/hooks/useScoreStatistics'

interface UseScoreDistributionActionsOptions {
  scoreStats: ComputedRef<ScoreStatisticsType | null>
  belowThresholdStudents: ComputedRef<ScoreStudentType[]>
  threshold: Ref<number> | ComputedRef<number>
  title?: Ref<string> | ComputedRef<string>
  getScore: (item: ScoreStudentType) => number | null
}

/** 将 DOM 元素渲染为 PNG DataURL */
const toPng = async (element: HTMLElement, scale = 2): Promise<string> => {
  const width = element.scrollWidth
  const height = element.scrollHeight

  return domtoimage.toPng(element, {
    quality: 1,
    bgcolor: '#fff',
    width: width * scale,
    height: height * scale,
    style: {
      transform: `scale(${scale})`,
      transformOrigin: '0 0',
      width: `${width}px`,
      height: `${height}px`
    }
  })
}

/**
 * 成绩分布操作（复制和图片导出）
 * 提供成绩统计数据复制到剪贴板、低分学生列表导出为图片的功能
 */
export function useScoreDistributionActions(options: UseScoreDistributionActionsOptions) {
  const { scoreStats, belowThresholdStudents, threshold, title, getScore } = options

  /** 将成绩分布统计复制到剪贴板 */
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

  /** 将低分学生列表导出为图片 */
  const downloadImage = async (mode: 'withScore' | 'nameOnly') => {
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
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.width = mode === 'withScore' ? '280px' : '180px'
    container.style.zIndex = '-1'
    container.style.pointerEvents = 'none'
    document.body.appendChild(container)

    startLoading('正在导出图片，请稍后...')

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const dataUrl = await toPng(container)
      const link = document.createElement('a')
      link.download = `低分学生_${threshold.value}分.png`
      link.href = dataUrl
      link.click()
      ElMessage.success('下载成功')
    } catch (error) {
      console.error('导出低分学生图片失败:', error)
      ElMessage.error('下载失败')
    } finally {
      stopLoading()
      container.remove()
    }
  }

  return {
    copyToClipboard,
    downloadImage
  }
}
