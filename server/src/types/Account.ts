/** 数据库内部账号记录，禁止直接用作接口响应。 */
export interface AccountRecordType {
  id: string
  phone: string
  nickname: string
  passwordHash: string
  role: 'ADMIN' | 'USER'
  status: 'ACTIVE' | 'DISABLED' | 'DELETED'
  superVip: number
  mustChangePassword: number
  authVersion: number
  version: number
  createdAt: number
  /** 代管身份操作保留真实操作者及授权会话。 */
  realActor?: AccountRecordType
  managedSessionId?: string
}

/** SQL 连接最小接口，生产使用 better-sqlite3，测试可注入临时数据库。 */
export interface DatabaseType {
  readonly inTransaction?: boolean
  exec(sql: string): void
  prepare(sql: string): {
    get(...params: (string | number | null)[]): unknown
    all(...params: (string | number | null)[]): unknown[]
    run(...params: (string | number | null)[]): { changes: number | bigint }
  }
  close(): void
}

/** actor 是真实操作者，owner 是经权限验证后的数据归属账号。 */
export interface AccessContextType {
  actor: AccountRecordType
  ownerId: string
  sessionId: string
  /** 服务端已校验的代管会话摘要，异步提交时再次验证。 */
  managedSessionId?: string
}
