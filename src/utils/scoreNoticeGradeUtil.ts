import { ScoreNoticeModeEnum, type ScoreNoticeGradeRuleType } from '@/types/ScoreNotice'

/** 百分制科目的默认等级规则 */
export const DEFAULT_100_SCORE_RULE: ScoreNoticeGradeRuleType = {
  maxScore: 100,
  gradeAMin: 80,
  gradeBMin: 60
}

/** 五十分制科目的默认等级规则 */
export const DEFAULT_50_SCORE_RULE: ScoreNoticeGradeRuleType = {
  maxScore: 50,
  gradeAMin: 40,
  gradeBMin: 30
}

/** 按五十分制计分的科目名称关键词 */
const FIFTY_SCORE_SUBJECTS = ['道法', '道德与法治', '科学']

/** 将 Excel 中可能带有“等”字的等级统一为 A、B、C。 */
export const normalizeGradeValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/等级|等/g, '')
  return ['A', 'B', 'C'].includes(normalized) ? normalized : null
}

/** 将任意值解析为有限数字，无法解析时返回 null */
export const parseNumericScore = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const score = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(score) ? score : null
}

/**
 * 按等级规则把分数转换为 A/B/C 等级。
 * @param value - 原始分数
 * @param rule - 等级规则（满分及 A/B 档分数线）
 * @returns 等级字母，无效或超出满分范围时返回 null
 */
export const convertScoreToGrade = (
  value: unknown,
  rule: ScoreNoticeGradeRuleType
): string | null => {
  const score = parseNumericScore(value)
  if (score === null || score < 0 || score > rule.maxScore) return null
  if (score >= rule.gradeAMin) return 'A'
  if (score >= rule.gradeBMin) return 'B'
  return 'C'
}

/** 根据科目名称推断其等级规则（道法/科学等按五十分制） */
export const getDefaultGradeRule = (subjectLabel: string): ScoreNoticeGradeRuleType => {
  const isFiftyScore = FIFTY_SCORE_SUBJECTS.some((item) => subjectLabel.includes(item))
  return { ...(isFiftyScore ? DEFAULT_50_SCORE_RULE : DEFAULT_100_SCORE_RULE) }
}

/**
 * 从少量非空样本推断导入数据形态。
 *
 * 以 70% 为阈值，避免个别空白或错误单元格把等级表误判为分数表。
 */
export const detectScoreNoticeMode = (values: unknown[]): ScoreNoticeModeEnum => {
  const samples = values.filter((value) => value !== null && value !== undefined && value !== '')
  if (!samples.length) return ScoreNoticeModeEnum.Grade
  const gradeCount = samples.filter((value) => normalizeGradeValue(value) !== null).length
  return gradeCount / samples.length >= 0.7 ? ScoreNoticeModeEnum.Grade : ScoreNoticeModeEnum.Score
}

/** 将分数格式化为展示文本：整数不带小数，小数保留一位，无效值显示 "--" */
export const formatScoreValue = (value: string | number | null): string => {
  const score = parseNumericScore(value)
  if (score === null) return '--'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}
