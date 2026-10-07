/** 首次设置状态；远程部署通过受控 CLI 初始化，不开放匿名管理员创建。 */
export interface SetupStatusType {
  required: boolean
  available: boolean
}
/** 系统自动生成随机临时密码，客户端保留本次请求以支持响应丢失后的安全重试。 */
export interface InitialAdminInputType {
  phone: string
  nickname?: string
  initialPassword: string
}
