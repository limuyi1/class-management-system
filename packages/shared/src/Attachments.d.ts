/** 文件路径与存储归属仅供服务器内部使用，不进入公开 DTO。 */
export interface AttachmentType {
  sortIndex?: number
  id: string
  name: string
  mimeType: 'image/png' | 'image/jpeg'
  size: number
  width: number
  height: number
  version: number
  createdAt: number
  updatedAt: number
}
export interface AttachmentListType {
  items: AttachmentType[]
  total: number
}
