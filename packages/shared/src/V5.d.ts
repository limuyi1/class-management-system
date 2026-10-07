/** 原 V5 页面使用的状态投影；服务器仍维护规范教学表与权限。 */
export interface V5StateType {
  workspaceId: string
  fingerprint: string
  stores: Record<string, Record<string, unknown>>
}
/** 整次提交携带读取指纹，阻止旧页面静默覆盖跨设备更新。 */
export interface V5WriteType {
  fingerprint: string
  stores: Record<string, Record<string, unknown>>
}
