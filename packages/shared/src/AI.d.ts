/** 平台统一模型或个人 Key；配置编辑接口可返回有权编辑的密钥。 */
export interface AIConfigType {
  provider: 'OPENAI' | 'GEMINI'
  baseUrl: string
  model: string
  /** 仅配置编辑接口提供，用于密码框回填。 */
  apiKey?: string
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

/** 模型目录查询使用表单中的服务地址和可选新密钥，不保存配置。 */
export interface AIModelQueryType {
  provider: AIConfigType['provider']
  baseUrl: string
  apiKey?: string
}
