import { ScoreNoticeModeEnum, type ScoreNoticeGradeRuleType } from '@/types/ScoreNotice'

export const DEFAULT_100_SCORE_RULE: ScoreNoticeGradeRuleType = {
  maxScore: 100,
  gradeAMin: 80,
  gradeBMin: 60
}

export const DEFAULT_50_SCORE_RULE: ScoreNoticeGradeRuleType = {
  maxScore: 50,
  gradeAMin: 40,
  gradeBMin: 30
}

const FIFTY_SCORE_SUBJECTS = ['道法', '道德与法治', '科学']

export const normalizeGradeValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/等级|等/g, '')
  return ['A', 'B', 'C'].includes(normalized) ? normalized : null
}

export const parseNumericScore = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const score = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(score) ? score : null
}

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

export const getDefaultGradeRule = (subjectLabel: string): ScoreNoticeGradeRuleType => {
  const isFiftyScore = FIFTY_SCORE_SUBJECTS.some((item) => subjectLabel.includes(item))
  return { ...(isFiftyScore ? DEFAULT_50_SCORE_RULE : DEFAULT_100_SCORE_RULE) }
}

export const detectScoreNoticeMode = (values: unknown[]): ScoreNoticeModeEnum => {
  const samples = values.filter((value) => value !== null && value !== undefined && value !== '')
  if (!samples.length) return ScoreNoticeModeEnum.Grade
  const gradeCount = samples.filter((value) => normalizeGradeValue(value) !== null).length
  return gradeCount / samples.length >= 0.7 ? ScoreNoticeModeEnum.Grade : ScoreNoticeModeEnum.Score
}

export const formatScoreValue = (value: string | number | null): string => {
  const score = parseNumericScore(value)
  if (score === null) return '--'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}
