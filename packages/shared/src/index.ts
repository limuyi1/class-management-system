/** 登录后对外展示的账号资料；密码哈希、令牌和其他用户的密钥不能进入 DTO。 */
export type {
  WorkspaceRecordType,
  EnrollmentType,
  CreateWorkspaceType,
  EditEnrollmentType,
  ManagedAccountType
} from './Workspace.js'

export interface UserProfileType {
  id: string
  phone: string
  nickname: string
  role: 'ADMIN' | 'USER'
  status: 'ACTIVE' | 'DISABLED' | 'DELETED'
  superVip: boolean
  mustChangePassword: boolean
  version: number
}

/** Web 登录响应；刷新令牌只通过 HttpOnly Cookie 传输。 */
export interface LoginResultType {
  accessToken: string
  expiresIn: number
  user: UserProfileType
}

/** API 错误保留稳定错误码，便于前端区分认证、权限和版本冲突。 */
export interface ApiErrorType {
  code: string
  message: string
  requestId: string
}

export type {
  AssessmentType,
  AssessmentInputType,
  ScoreRecordType,
  ScoreChangeType,
  ScoreConflictType,
  ReferenceInputType,
  ReferenceProjectionType,
  ScoreStateType
} from './Scores.js'

export type {
  CommentRecordType,
  CommentChangeType,
  CommentStateType,
  NoticeConfigType,
  NoticeDocumentType,
  NoticeSubjectConfigType,
  TeachingSnapshotType
} from './Teaching.js'

export type {
  ClassroomToolKindType,
  ClassroomToolContentType,
  ClassroomToolRecordType,
  ClassroomToolStateType
} from './ClassroomTools.js'

export type { AttachmentType, AttachmentListType } from './Attachments.js'

export type { AIConfigType, AIConfigInputType, AIQuotaType, AISettingsType } from './AI.js'

export type { SetupStatusType, InitialAdminInputType } from './Setup.js'

export type { CaptchaChallengeType } from './Captcha.js'
