/**
 * AI 识图成绩识别工具
 * 负责把 AI 识别的成绩结果转换为可预览、可校验的写入行，避免直接污染成绩数据。
 */
import { NAME_PROP } from '@/constants'
import type { StudentDataType } from '@/types/StudentData'

/** AI 识图返回的单条成绩识别结果 */
export interface ScoreRecognitionResultType {
  name: string
  /** 图片原姓名；旧格式结果不包含时，按 name 处理 */
  rawName?: string | null
  /** 模型明确无法对应时为 null；旧格式结果不包含 */
  matchedName?: string | null
  score: number | null
}

/** 成绩识别预览行，供预览对话框展示与勾选 */
export interface ScoreRecognitionPreviewRowType {
  /** 名册姓名 */
  name: string
  /** AI 从图片中读出的姓名；未识别到时为 null */
  rawName: string | null
  /** 名册中的学生 ID */
  studentId: string
  /** 是否由 AI 结果唯一匹配到名册学生 */
  matched: boolean
  /** 匹配结果来源 */
  source: 'matched' | 'suggested' | 'missing'
  /** 识别到的分数 */
  score: number | null
  /** 分数是否有效（有限数字且在 0~满分 范围内） */
  valid: boolean
  /** 该生当前科目已有的分数 */
  existingScore: number | null
  /** 是否会覆盖已有分数 */
  willOverwrite: boolean
}

/**
 * 校验分数是否有效：有限数字且落在 0~满分 范围内。
 * @param score - 待校验的分数
 * @param fullMark - 满分
 * @returns 是否有效
 */
export const isValidScore = (
  score: number | null | undefined,
  fullMark: number
): boolean => {
  if (typeof score !== 'number' || !Number.isFinite(score)) return false
  return score >= 0 && score <= fullMark
}

/**
 * 按当前启用名册生成预览行，完成唯一姓名匹配、分数校验与覆盖标记。
 * @param results - AI 识别的成绩结果列表
 * @param students - 系统学生数据
 * @param scoreTab - 当前录入的成绩列 prop
 * @param fullMark - 成绩满分
 * @returns 预览行数组
 */
export const buildScoreRecognitionPreview = (
  results: ScoreRecognitionResultType[],
  students: StudentDataType[],
  scoreTab: string,
  fullMark: number
): ScoreRecognitionPreviewRowType[] => {
  const activeStudents = students.filter((student) => student.disabled !== true)
  const studentNameCounts = new Map<string, number>()
  const resultNameCounts = new Map<string, number>()
  activeStudents.forEach((student) => {
    const name = String(student[NAME_PROP] || '')
    studentNameCounts.set(name, (studentNameCounts.get(name) || 0) + 1)
  })
  results.forEach((result) => {
    resultNameCounts.set(result.name, (resultNameCounts.get(result.name) || 0) + 1)
  })

  return activeStudents.map((student): ScoreRecognitionPreviewRowType => {
    const name = String(student[NAME_PROP] || '')
    const hasUniqueResult =
      !!name && studentNameCounts.get(name) === 1 && resultNameCounts.get(name) === 1
    const result = hasUniqueResult ? results.find((item) => item.name === name) : undefined
    const rawName = result ? (result.rawName === undefined ? result.name : result.rawName) : null
    const matched = !!result && rawName === name && result.matchedName !== null
    const rawExisting = scoreTab ? student[scoreTab] : null
    const existingScore =
      typeof rawExisting === 'number' && Number.isFinite(rawExisting) ? rawExisting : null
    const score = result?.score ?? null
    const valid = isValidScore(score, fullMark)

    return {
      name,
      rawName,
      studentId: student.studentId,
      matched,
      source: matched ? 'matched' : result ? 'suggested' : 'missing',
      score,
      valid,
      existingScore,
      willOverwrite: !!result && existingScore !== null && existingScore !== score
    }
  })
}

/** 返回 AI 识别到但不在当前启用名册中的姓名，用于顶部提示。 */
export const getIgnoredScoreRecognitionNames = (
  results: ScoreRecognitionResultType[],
  students: StudentDataType[]
): string[] => {
  const rosterNames = new Set(
    students
      .filter((student) => student.disabled !== true)
      .map((student) => String(student[NAME_PROP] || ''))
  )
  return results
    .filter((result) => !rosterNames.has(result.name))
    .map((result) => result.rawName || result.name || '姓名无法辨认')
}
