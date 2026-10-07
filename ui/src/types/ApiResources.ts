/** 账号/学期下的独立版本资源，不包含图片 Blob 或密钥。 */
export interface ResourceType {
  id: string
  kind: 'paper' | 'tags' | 'settings'
  workspaceId: string | null
  name: string
  content: Record<string, unknown>
  version: number
  updatedAt: number
}
export interface AICallResultType {
  id: string
  status: string
  result: { text: string; inputTokens: number; outputTokens: number } | null
}
