/** 前端只保留响应白名单，数据库内部哈希不进入页面。 */
export interface AccountProfileType {
  id: string
  phone: string
  nickname: string
  role: 'ADMIN' | 'USER'
  status: 'ACTIVE' | 'DISABLED' | 'DELETED'
  superVip: boolean
  mustChangePassword: boolean
  version: number
}
