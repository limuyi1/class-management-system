import type { EnrollmentType, WorkspaceRecordType } from './Workspace.js'

/** 原 prop 用于兼容原动态表格；姓名等基础字段不能成为测评。 */
export interface AssessmentType {
  id: string
  workspaceId: string
  prop: string
  label: string
  sortIndex: number
  disabled: boolean
  fullMark: number | null
  version: number
}
export interface AssessmentInputType {
  label: string
  disabled: boolean
  fullMark: number | null
  sortIndex: number
  prop?: string
}
export interface ScoreRecordType {
  studentId: string
  assessmentId: string
  value: number | null
  version: number
}
/** 0 表示预期尚无记录，清空用 null，不能用 0 代替空值。 */
export interface ScoreChangeType {
  studentId: string
  assessmentId: string
  value: number | null
  expectedVersion: number
}
export interface ScoreConflictType {
  studentId: string
  assessmentId: string
  current: ScoreRecordType | null
}
export interface ReferenceInputType {
  sourceWorkspaceId: string
  assessmentId: string
}
export interface ReferenceScoreType extends ScoreRecordType {
  rank: number | null
}
export interface ReferenceProjectionType extends ReferenceInputType {
  label: string
  fullMark: number
  prop: string
  scores: ReferenceScoreType[]
}
export interface ScoreStatisticType {
  assessmentId: string
  count: number
  missing: number
  average: number | null
  min: number | null
  max: number | null
}
/** 本期记录与只读历史投影明确分开，统计只使用本期有效名单。 */
export interface ScoreStateType {
  workspace: WorkspaceRecordType
  students: EnrollmentType[]
  assessments: AssessmentType[]
  scores: ScoreRecordType[]
  references: ReferenceProjectionType[]
  statistics: ScoreStatisticType[]
}
