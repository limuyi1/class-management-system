import type { EnrollmentType, WorkspaceRecordType } from './Workspace.js'
import type { ScoreStateType } from './Scores.js'

export interface CommentRecordType {
  studentId: string
  text: string
  version: number
}
export interface CommentChangeType {
  studentId: string
  text: string
  expectedVersion: number
}
export interface CommentStateType {
  workspace: WorkspaceRecordType
  students: EnrollmentType[]
  comments: CommentRecordType[]
}
export interface NoticeSubjectConfigType {
  assessmentId: string
  maxScore: number
  gradeAMin: number
  gradeBMin: number
}
/** 只存通知单版式与本期科目选择，学生姓名、成绩和评语每次从业务数据读取。 */
export interface NoticeConfigType {
  title: string
  noticeDate: string
  mode: 'score' | 'grade'
  subjects: NoticeSubjectConfigType[]
}
export interface NoticeDocumentType {
  config: NoticeConfigType | null
  version: number
}
/** 同一事务捕获导出快照；客户端导出过程中保持快照，不重新拼接多个时间点的数据。 */
export interface TeachingSnapshotType {
  scores: ScoreStateType
  comments: CommentRecordType[]
  notice: NoticeDocumentType
}
