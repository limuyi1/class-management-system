/** 共享 DTO 不含数据库连接或 Vue 状态，前后端对同一接口使用一致字段。 */
export interface WorkspaceRecordType {
  id: string
  ownerId: string
  classId: string
  className: string
  termName: string
  scoreFullMark: number
  version: number
  createdAt: number
  updatedAt: number
}

/** 每学期独立名单；相同 studentId 可以跨期，姓名/状态保留当期值。 */
export interface EnrollmentType {
  studentId: string
  name: string
  disabled: boolean
  departed: boolean
  departedAt: number | null
  version: number
}

export interface CreateWorkspaceType {
  className: string
  termName: string
  classId?: string
  scoreFullMark?: number
}

export interface EditEnrollmentType {
  name: string
  disabled: boolean
  departed: boolean
  version: number
}

/** 顶部选择器只提供必要摘要，不返回目标账号密码、令牌或 AI 配置。 */
export interface ManagedAccountType {
  id: string
  nickname: string
  phoneSuffix: string
  status: 'ACTIVE' | 'DISABLED'
}
