import domtoimage from 'dom-to-image'

import { NAME_PROP } from '@/types/Constants'
import type { SettingType, TagCategoryType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import { extractStudentTags } from '@/utils/studentUntil'

interface OperationResultType {
  success: boolean
  error?: Error
}

export interface StudentReportScoreItemType {
  prop: string
  label: string
  score: number | null
  average: number | null
  rank: number | null
  delta: number | null
}

type StudentReportValidScoreItemType = Omit<
  StudentReportScoreItemType,
  'score' | 'average' | 'rank'
> & {
  score: number
  average: number
  rank: number
}

export interface StudentReportSummaryStatType {
  label: string
  value: string
  hint: string
  tone: 'teal' | 'blue' | 'orange' | 'purple'
  icon: string
}

export interface StudentReportSummaryType {
  averageScore: number
  highestScore: number
  lowestScore: number
  progressCount: number
  trendLabel: string
  totalDelta: number
  bestScore: StudentReportValidScoreItemType | null
  worstScore: StudentReportValidScoreItemType | null
  bestRank: StudentReportValidScoreItemType | null
  worstRank: StudentReportValidScoreItemType | null
  statCards: StudentReportSummaryStatType[]
}

export interface StudentReportInsightType {
  title: string
  items: string[]
}

export interface StudentReportDataType {
  studentName: string
  classLabel: string
  studentCount: number
  classAverageScore: number
  generatedAtText: string
  headline: string
  overviewLead: string
  scoreItems: StudentReportScoreItemType[]
  summary: StudentReportSummaryType
  tags: string[]
  strengths: string[]
  concerns: string[]
  insights: StudentReportInsightType[]
}

export interface StudentReportExportOptionsType {
  scale?: number
  backgroundColor?: string
}

const toScoreValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const calculateAverage = (scores: number[]): number => {
  if (!scores.length) return 0
  return scores.reduce((sum, item) => sum + item, 0) / scores.length
}

const formatRankText = (rank: number | null): string => {
  if (!rank) return '--'
  return `第 ${rank} 名`
}

const getValidScoreItems = (scoreItems: StudentReportScoreItemType[]): StudentReportValidScoreItemType[] =>
  scoreItems.filter((item): item is StudentReportValidScoreItemType => {
    return item.score !== null && item.average !== null && item.rank !== null
  })

const formatGeneratedAt = (): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
    .format(new Date())
    .replace(/\//g, '-')
}

const resolveTrendLabel = (scoreItems: StudentReportScoreItemType[]): string => {
  const validScoreItems = getValidScoreItems(scoreItems)
  if (validScoreItems.length <= 1) return '整体稳定'

  const deltas = validScoreItems
    .slice(1)
    .map((item) => item.delta || 0)
    .filter((item) => item !== 0)

  if (!deltas.length) return '整体稳定'

  const positiveCount = deltas.filter((item) => item > 0).length
  const negativeCount = deltas.filter((item) => item < 0).length
  const totalDelta = validScoreItems[validScoreItems.length - 1].score - validScoreItems[0].score

  if (totalDelta >= 8 && positiveCount >= negativeCount) return '稳步上升'
  if (totalDelta <= -8 && negativeCount >= positiveCount) return '阶段回落'
  if (positiveCount > 0 && negativeCount > 0) return '存在波动'
  if (totalDelta > 0) return '后期回升'
  if (totalDelta < 0) return '略有波动'
  return '整体稳定'
}

const buildStrengths = (
  scoreItems: StudentReportScoreItemType[],
  summary: StudentReportSummaryType,
  tags: string[]
): string[] => {
  const result: string[] = []
  const validScoreItems = getValidScoreItems(scoreItems)

  if (summary.bestScore && summary.bestScore.score >= 90) {
    result.push(`${summary.bestScore.label}发挥亮眼，单次成绩达到 ${summary.bestScore.score} 分`)
  }

  if (summary.totalDelta >= 8) {
    result.push('最近几个阶段成绩有明显提升，学习状态正在走稳')
  }

  if (
    validScoreItems.length &&
    validScoreItems.filter((item) => item.score >= item.average).length >= Math.ceil(validScoreItems.length / 2)
  ) {
    result.push('大部分阶段成绩高于班级平均水平，整体处于班级前列')
  }

  if (tags.length > 0) {
    result.push(`学习表现中呈现出${tags.slice(0, 2).join('、')}等积极特点`)
  }

  return result.slice(0, 3)
}

const buildConcerns = (
  scoreItems: StudentReportScoreItemType[],
  summary: StudentReportSummaryType
): string[] => {
  const result: string[] = []
  const validScoreItems = getValidScoreItems(scoreItems)

  const firstBelowAverage = validScoreItems.find((item) => item.score < item.average)
  if (firstBelowAverage) {
    result.push(`${firstBelowAverage.label}成绩相对较低，和班平均还有一定差距`)
  }

  if (summary.progressCount < Math.max(validScoreItems.length - 2, 1) && summary.totalDelta <= 0) {
    result.push('几个阶段中单元波动较大，稳定性仍需加强')
  }

  if (summary.highestScore - summary.lowestScore >= 10) {
    result.push('多次考试分差较明显，粗心或发挥波动仍需注意')
  }

  if (!result.length) {
    result.push('当前阶段整体较稳，后续可继续关注持续性表现')
  }

  return result.slice(0, 3)
}

const buildOverviewLead = (
  studentName: string,
  scoreItems: StudentReportScoreItemType[],
  summary: StudentReportSummaryType
): string => {
  const validScoreItems = getValidScoreItems(scoreItems)
  if (!validScoreItems.length) return `${studentName}同学当前暂无可展示的阶段成绩数据。`

  const latestScore = validScoreItems[validScoreItems.length - 1]
  const latestDiff = latestScore.score - latestScore.average
  const latestDiffText =
    latestDiff === 0 ? '与班平均持平' : `${latestDiff > 0 ? '高于' : '低于'}班平均 ${Math.abs(latestDiff).toFixed(1)} 分`

  return `本阶段共记录 ${scoreItems.length} 次成绩，最近一次 ${latestScore.score} 分。${latestDiffText}，整体成绩${summary.trendLabel}。`
}

const buildStatCards = (summary: StudentReportSummaryType): StudentReportSummaryStatType[] => {
  return [
    {
      label: '最好成绩',
      value: summary.bestScore ? `${summary.bestScore.score} 分` : '--',
      hint: summary.bestScore ? `出现在 ${summary.bestScore.label}` : '暂无数据',
      tone: 'teal',
      icon: 'trophy'
    },
    {
      label: '最好成绩班级名次',
      value: summary.bestRank ? formatRankText(summary.bestRank.rank) : '--',
      hint: summary.bestRank ? `出现在 ${summary.bestRank.label}` : '暂无数据',
      tone: 'blue',
      icon: 'award'
    },
    {
      label: '最差成绩',
      value: summary.worstScore ? `${summary.worstScore.score} 分` : '--',
      hint: summary.worstScore ? `出现在 ${summary.worstScore.label}` : '暂无数据',
      tone: 'orange',
      icon: 'chart-line'
    },
    {
      label: '最差成绩班级名次',
      value: summary.worstRank ? formatRankText(summary.worstRank.rank) : '--',
      hint: summary.worstRank ? `出现在 ${summary.worstRank.label}` : '暂无数据',
      tone: 'purple',
      icon: 'medal'
    }
  ]
}

const buildInsights = (strengths: string[], concerns: string[]): StudentReportInsightType[] => {
  return [
    {
      title: '优势表现',
      items: strengths.length ? strengths : ['整体表现较稳，已经具备继续提升的基础']
    },
    {
      title: '关注点',
      items: concerns.length ? concerns : ['当前暂无明显短板，可继续保持稳定发挥']
    }
  ]
}

/**
 * 将学生原始成绩数据整理为“学习报告”展示模型。
 * 这里集中处理均分、名次、趋势和洞察，页面层只负责渲染。
 */
export function buildStudentReportData(options: {
  student: StudentDataType
  students: StudentDataType[]
  scoreColumns: SettingType[]
  selectedProps: string[]
  tagCategories: TagCategoryType[]
  classLabel?: string
}): StudentReportDataType {
  const { student, students, scoreColumns, selectedProps, tagCategories, classLabel = '本班' } = options
  const selectedColumns = scoreColumns.filter((item) => selectedProps.includes(item.prop))
  let previousScore: number | null = null
  const scoreItems: StudentReportScoreItemType[] = selectedColumns
    .map((column) => {
      const score = toScoreValue(student[column.prop])
      const allScores = students
        .map((item) => toScoreValue(item[column.prop]))
        .filter((item): item is number => item !== null)
      const average = allScores.length ? calculateAverage(allScores) : null
      const rank =
        score !== null && allScores.length
          ? [...allScores].sort((a, b) => b - a).findIndex((item) => item === score) + 1 || allScores.length
          : null
      const delta = score === null || previousScore === null ? null : score - previousScore

      if (score !== null) {
        previousScore = score
      }

      return {
        prop: column.prop,
        label: column.label,
        score,
        average,
        rank,
        delta
      }
    })

  const validScoreItems = getValidScoreItems(scoreItems)
  const scoreValues = validScoreItems.map((item) => item.score)
  const selectedScoreProps = new Set(scoreItems.map((item) => item.prop))
  const classScoreValues = students.flatMap((studentItem) =>
    selectedColumns
      .filter((column) => selectedScoreProps.has(column.prop))
      .map((column) => toScoreValue(studentItem[column.prop]))
      .filter((score): score is number => score !== null)
  )
  const progressCount = validScoreItems.filter((item) => (item.delta || 0) > 0).length
  const totalDelta =
    validScoreItems.length > 1
      ? validScoreItems[validScoreItems.length - 1].score - validScoreItems[0].score
      : 0
  const bestScore = validScoreItems.length
    ? validScoreItems.reduce((best, item) => (item.score > best.score ? item : best), validScoreItems[0])
    : null
  const worstScore = validScoreItems.length
    ? validScoreItems.reduce((worst, item) => (item.score < worst.score ? item : worst), validScoreItems[0])
    : null
  const bestRank = validScoreItems.length
    ? validScoreItems.reduce((best, item) => (item.rank < best.rank ? item : best), validScoreItems[0])
    : null
  const worstRank = validScoreItems.length
    ? validScoreItems.reduce((worst, item) => (item.rank > worst.rank ? item : worst), validScoreItems[0])
    : null

  const baseSummary: Omit<StudentReportSummaryType, 'statCards'> = {
    averageScore: Number(calculateAverage(scoreValues).toFixed(1)),
    highestScore: scoreValues.length ? Math.max(...scoreValues) : 0,
    lowestScore: scoreValues.length ? Math.min(...scoreValues) : 0,
    progressCount,
    trendLabel: resolveTrendLabel(scoreItems),
    totalDelta,
    bestScore,
    worstScore,
    bestRank,
    worstRank
  }

  const summary: StudentReportSummaryType = {
    ...baseSummary,
    statCards: []
  }

  summary.statCards = buildStatCards(summary)

  const tags = extractStudentTags(student, tagCategories)
  const strengths = buildStrengths(scoreItems, summary, tags)
  const concerns = buildConcerns(scoreItems, summary)
  const studentName = String(student[NAME_PROP] || '')

  return {
    studentName,
    classLabel,
    studentCount: students.length,
    classAverageScore: Number(calculateAverage(classScoreValues).toFixed(1)),
    generatedAtText: formatGeneratedAt(),
    headline: validScoreItems.length ? `${studentName}学习报告` : `${studentName}阶段学习报告`,
    overviewLead: buildOverviewLead(studentName, scoreItems, summary),
    scoreItems,
    summary,
    tags,
    strengths,
    concerns,
    insights: buildInsights(strengths, concerns)
  }
}

export function buildStudentReportTemplateText(report: StudentReportDataType): string {
  const { studentName, scoreItems, summary, strengths, concerns } = report
  const validScoreItems = getValidScoreItems(scoreItems)
  const firstLabel = validScoreItems[0]?.label || '本阶段'
  const lastLabel = validScoreItems[validScoreItems.length - 1]?.label || '当前阶段'
  const firstScore = validScoreItems[0]?.score ?? 0
  const lastScore = validScoreItems[validScoreItems.length - 1]?.score ?? 0
  const firstBest = strengths[0] || '整体成绩处于可持续提升的区间'
  const firstConcern = concerns[0] || '后续可继续关注稳定性和持续发挥'

  const paragraphs = [
    `${studentName}同学在本阶段的学习表现整体呈现${summary.trendLabel}的特点。由${firstLabel}的${firstScore}分到${lastLabel}的${lastScore}分，可以看出他的学习状态正在逐步调整并走向更稳定的节奏。`,
    `从所选成绩来看，阶段平均分为${summary.averageScore}分，最高分为${summary.highestScore}分，最低分为${summary.lowestScore}分。${firstBest}。`,
    `${firstConcern}。总体来看，他已经展现出较好的发展势头，后续若能保持当前状态，成绩仍有继续提升的空间。`
  ]

  return paragraphs.join('\n\n')
}

/**
 * 按当前预览节点直接导出 PNG。
 * 导出逻辑收敛在工具层，避免弹窗组件同时处理下载细节。
 */
export async function exportStudentReportImage(
  element: HTMLElement,
  fileName: string,
  options: StudentReportExportOptionsType = {}
): Promise<OperationResultType> {
  const { scale = 2, backgroundColor = '#FFFFFF' } = options

  try {
    const dataUrl = await domtoimage.toPng(element, {
      quality: 1,
      bgcolor: backgroundColor,
      width: element.offsetWidth * scale,
      height: element.offsetHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: '0 0'
      }
    })

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = fileName
    link.click()

    return { success: true }
  } catch (error) {
    const resultError = error instanceof Error ? error : new Error('导出图片失败')
    console.error('导出学生报告图片失败:', resultError)
    return { success: false, error: resultError }
  }
}
