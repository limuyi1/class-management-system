import type {
  StudentReportScoreItemType,
  StudentReportSummaryType,
  StudentReportDataType
} from '../../../../packages/shared/src/Reports.js'
import {
  toScoreValue,
  calculateAverage,
  getValidScoreItems,
  formatGeneratedAt,
  resolveTrendLabel,
  buildStrengths,
  buildConcerns,
  buildOverviewLead,
  buildStatCards,
  buildInsights
} from './reportInsights.js'
import type { ReportStudentType, ReportColumnType, ReportTagCategoryType } from './types.js'
const NAME_PROP = 'name'
/** 提取本期标签，分类顺序不改变学生身份。 */
function extractStudentTags(
  student: ReportStudentType,
  categories: ReportTagCategoryType[]
): string[] {
  return [...new Set(categories.flatMap((category) => student.tags?.[category.prop] || []))]
}
/**
 * 将学生原始成绩数据整理为“学习报告”展示模型。
 * 这里集中处理均分、名次、趋势和洞察，页面层只负责渲染。
 * @param options - 报告构建参数（学生、全班数据、成绩列、选中列、标签分类及班级名）
 * @returns 学生报告展示模型
 */
export function buildStudentReportData(options: {
  student: ReportStudentType
  students: ReportStudentType[]
  scoreColumns: ReportColumnType[]
  selectedProps: string[]
  tagCategories: ReportTagCategoryType[]
  classLabel?: string
  historicalScores?: Map<string, number[]>
  historicalRanks?: Map<string, Map<string, number>>
}): StudentReportDataType {
  const {
    student,
    students,
    scoreColumns,
    selectedProps,
    tagCategories,
    classLabel = '本班'
  } = options
  const selectedColumns = scoreColumns.filter((item) => selectedProps.includes(item.prop))
  // 上一个非空成绩，用于计算相邻两次成绩的变化值 delta（成绩缺失时不打断连续变化）
  let previousScore: number | null = null
  const scoreItems: StudentReportScoreItemType[] = selectedColumns.map((column) => {
    const score = toScoreValue(student[column.prop])
    const allScores =
      options.historicalScores?.get(column.prop) ??
      students
        .map((item) => toScoreValue(item[column.prop]))
        .filter((item): item is number => item !== null)
    const average = allScores.length ? calculateAverage(allScores) : null
    // 名次按成绩降序取第一次出现的下标，未找到时回退为末尾名次。
    const rank = options.historicalRanks?.has(column.prop)
      ? (options.historicalRanks.get(column.prop)?.get(student.studentId) ?? null)
      : score !== null && allScores.length
        ? [...allScores].sort((a, b) => b - a).findIndex((item) => item === score) + 1 ||
          allScores.length
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
      rankCount: allScores.length,
      delta
    }
  })

  const validScoreItems = getValidScoreItems(scoreItems)
  const scoreValues = validScoreItems.map((item) => item.score)
  const selectedScoreProps = new Set(scoreItems.map((item) => item.prop))
  // 汇总全班在所选科目上的所有有效成绩，用于计算班级均分。
  const classScoreValues = selectedColumns
    .filter((column) => selectedScoreProps.has(column.prop))
    .flatMap(
      (column) =>
        options.historicalScores?.get(column.prop) ??
        students
          .map((studentItem) => toScoreValue(studentItem[column.prop]))
          .filter((score): score is number => score !== null)
    )
  // 进步次数：相邻变化为正的次数；总变化：末次有效成绩与首次有效成绩之差
  const progressCount = validScoreItems.filter((item) => (item.delta || 0) > 0).length
  const totalDelta =
    validScoreItems.length > 1
      ? validScoreItems[validScoreItems.length - 1].score - validScoreItems[0].score
      : 0
  // 通过 reduce 在有效成绩项中挑选最好/最差成绩与最好/最差名次
  const bestScore = validScoreItems.length
    ? validScoreItems.reduce(
        (best, item) => (item.score > best.score ? item : best),
        validScoreItems[0]
      )
    : null
  const worstScore = validScoreItems.length
    ? validScoreItems.reduce(
        (worst, item) => (item.score < worst.score ? item : worst),
        validScoreItems[0]
      )
    : null
  const bestRank = validScoreItems.length
    ? validScoreItems.reduce(
        (best, item) => (item.rank < best.rank ? item : best),
        validScoreItems[0]
      )
    : null
  const worstRank = validScoreItems.length
    ? validScoreItems.reduce(
        (worst, item) => (item.rank > worst.rank ? item : worst),
        validScoreItems[0]
      )
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

/**
 * 根据报告数据生成可复制的模板文本。
 * @param report - 学生报告数据
 * @returns 多段落的报告模板文本
 */
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
