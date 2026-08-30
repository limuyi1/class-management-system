/**
 * AI 识图成绩识别工具
 * 负责把 AI 识别的成绩结果转换为可预览、可校验的写入行，避免直接污染成绩数据。
 */
import { NAME_PROP } from '@/constants'
import type { StudentDataType } from '@/types/StudentData'

/** AI 识图返回的单条成绩识别结果 */
export interface ScoreRecognitionResultType {
  name: string
  score: number | null
}

/** 成绩识别预览行，供预览对话框展示与勾选 */
export interface ScoreRecognitionPreviewRowType {
  /** 识别到的学生姓名 */
  name: string
  /** 唯一匹配到的学生 ID；重名或未匹配时为 null */
  studentId: string | null
  /** 是否唯一匹配到系统学生 */
  matched: boolean
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
 * 把 AI 识别的成绩结果转换为预览行，完成姓名匹配、分数校验与覆盖标记。
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
  return results.map((result) => {
    const name = result.name
    const matchedStudents = students.filter(
      (student) => String(student[NAME_PROP] || '') === name
    )
    const matched = matchedStudents.length === 1
    const student = matched ? matchedStudents[0] : undefined
    const studentId = student ? student.studentId : null

    const rawExisting = student && scoreTab ? student[scoreTab] : null
    const existingScore =
      typeof rawExisting === 'number' && Number.isFinite(rawExisting) ? rawExisting : null

    const score = result.score
    const valid = isValidScore(score, fullMark)

    return {
      name,
      studentId,
      matched,
      score,
      valid,
      existingScore,
      willOverwrite: matched && existingScore !== null && existingScore !== score
    }
  })
}
