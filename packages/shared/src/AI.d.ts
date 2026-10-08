/** 平台统一模型或个人 Key；配置编辑接口可返回有权编辑的密钥。 */
export interface AIConfigType {
  provider: 'OPENAI' | 'GEMINI'
  baseUrl: string
  model: string
  /** 仅配置编辑接口提供，用于密码框回填。 */
  apiKey?: string
  /** 编辑接口无法解密旧密钥时提示重新填写，原密文仍保留。 */
  keyUnavailable?: boolean
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

/** 管理员调用记录保留真实操作者与数据归属，账号摘要不包含身份凭据。 */
export interface AICallRecordType {
  id: string
  actorId: string
  ownerId: string
  actorNickname: string | null
  actorPhone: string | null
  ownerNickname: string | null
  ownerPhone: string | null
  mode: string
  status: string
  inputTokens: number | null
  outputTokens: number | null
  createdAt: number
}
