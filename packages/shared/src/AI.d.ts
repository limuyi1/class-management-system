/** 平台统一模型或个人 Key；响应永远不包含明文或密文密钥。 */
export interface AIConfigType {
  provider: 'OPENAI' | 'GEMINI'
  baseUrl: string
  model: string
  configured: boolean
  enabled: boolean
  version: number
}
export interface AIConfigInputType {
  provider: 'OPENAI' | 'GEMINI'
  baseUrl: string
  model: string
  enabled: boolean
  version: number
  apiKey?: string | null
}
/** available 是可用余额，reserved 是调用预占，used 是已结算累计消耗。 */
export interface AIQuotaType {
  available: number
  reserved: number
  used: number
  version: number
}
export interface AISettingsType {
  mode: 'PLATFORM' | 'PERSONAL'
  version: number
  personal: AIConfigType
  platform: Pick<AIConfigType, 'model' | 'provider' | 'baseUrl' | 'enabled' | 'configured'>
  quota: AIQuotaType
}

/** 额度分页列表的账号摘要，仅展示老师额度，不包含密钥或设备信息。 */
export interface AIQuotaAccountType extends AIQuotaType {
  id: string
  phone: string
  nickname: string
  status: 'ACTIVE' | 'DISABLED'
}
export interface AIQuotaListType {
  items: AIQuotaAccountType[]
  total: number
  page: number
  pageSize: number
}
