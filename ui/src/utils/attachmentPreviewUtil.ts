import type { AttachmentRecordType } from '@/types/Tools'
/** 将已经鉴权取得的图片转为临时 URL，不读取本地数据库；调用者负责释放。 */
export const attachmentToObjectUrl = (attachment: AttachmentRecordType): string =>
  URL.createObjectURL(attachment.blob)
