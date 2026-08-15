import { db } from '@/db'
import { base64ToBlob, blobToDataUrl, fileToBlob } from '@/utils/fileUtil'
import type { AttachmentRecordType } from '@/types/Tools'

/** 生成带前缀的唯一 ID（时间戳 + 随机数） */
const createId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** 生成 yyyyMMdd_HHmmss 形式的时间戳后缀，用于文件重命名 */
const getTimestampSuffix = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hour}${minute}${second}`
}

/** 在文件名主名与扩展名之间插入时间戳后缀，避免重名覆盖 */
const appendTimestampToFileName = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) {
    return `${fileName}_${getTimestampSuffix()}`
  }

  return `${fileName.slice(0, dotIndex)}_${getTimestampSuffix()}${fileName.slice(dotIndex)}`
}

/** 通过创建 Image 读取图片的原始宽高 */
const getImageSize = (source: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      })
    }
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = source
  })
}

/** 读取 Blob 图片的原始宽高（内部用 object URL 承载，读完即释放） */
const getBlobImageSize = async (blob: Blob): Promise<{ width: number; height: number }> => {
  const url = URL.createObjectURL(blob)
  try {
    return await getImageSize(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 将任意图片文件统一转成可嵌入的 JPEG/PNG Blob。
 * 非 PNG/JPEG 的图片先绘制到白色画布上再导出，避免透明背景影响排版。
 */
const normalizeImageBlob = async (file: File): Promise<Blob> => {
  const blob = await fileToBlob(file)
  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    return blob
  }

  const dataUrl = await blobToDataUrl(blob)
  const size = await getImageSize(dataUrl)
  const image = new Image()
  image.src = dataUrl
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return blob

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob || blob), 'image/jpeg', 0.92)
  })
}

/**
 * 读取全部素材记录。
 * 先按 sortOrder 升序，缺失 sortOrder 时回退到创建时间倒序。
 *
 * @returns 排序后的素材记录列表
 */
export const getAttachments = async (): Promise<AttachmentRecordType[]> => {
  const records = await db.attachments.toArray()
  return records.sort((first, second) => {
    const firstOrder = first.sortOrder ?? 0
    const secondOrder = second.sortOrder ?? 0
    if (firstOrder !== secondOrder) return firstOrder - secondOrder

    return second.createdAt.localeCompare(first.createdAt)
  })
}

/**
 * 将图片文件转换为素材记录（不写入数据库）。
 *
 * @param files 待处理的文件列表
 * @param options idPrefix ID 前缀；startSortOrder 起始排序值；existingNames 已存在的文件名（用于重名处理）
 * @returns 生成的素材记录列表
 */
export const createAttachmentRecordsFromFiles = async (
  files: File[],
  options: {
    idPrefix?: string
    startSortOrder?: number
    existingNames?: Set<string>
  } = {}
): Promise<AttachmentRecordType[]> => {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  const existingNames = options.existingNames || new Set<string>()
  let nextSortOrder = options.startSortOrder ?? 0
  const nextNames = new Set<string>()

  return Promise.all(
    imageFiles.map(async (file) => {
      const blob = await normalizeImageBlob(file)
      const size = await getBlobImageSize(blob)
      const now = new Date().toISOString()
      // 与已有文件或本次批量内的其他文件重名时，追加时间戳避免覆盖
      const duplicateName = existingNames.has(file.name) || nextNames.has(file.name)
      const name = duplicateName ? appendTimestampToFileName(file.name) : file.name
      nextNames.add(name)

      return {
        id: createId(options.idPrefix || 'attachment'),
        name,
        mimeType: blob.type || file.type || 'image/jpeg',
        blob,
        sortOrder: nextSortOrder++,
        width: size.width,
        height: size.height,
        size: blob.size,
        createdAt: now,
        updatedAt: now
      }
    })
  )
}

/**
 * 将图片文件写入素材库，自动处理重名并续接排序值。
 *
 * @param files 待添加的文件列表
 * @returns 新增的素材记录列表
 */
export const addFilesToAttachments = async (files: File[]): Promise<AttachmentRecordType[]> => {
  const existingAttachments = await getAttachments()
  const existingNames = new Set(existingAttachments.map((attachment) => attachment.name))
  const hasSortOrder = existingAttachments.some(
    (attachment) => typeof attachment.sortOrder === 'number'
  )
  // 老数据可能没有 sortOrder，此时回退用现有数量续接，避免新旧排序错乱
  const nextSortOrder = hasSortOrder
    ? existingAttachments.reduce(
        (maxOrder, attachment) => Math.max(maxOrder, attachment.sortOrder ?? -1),
        -1
      ) + 1
    : existingAttachments.length
  const records = await createAttachmentRecordsFromFiles(files, {
    existingNames,
    startSortOrder: nextSortOrder
  })

  if (records.length > 0) {
    await db.attachments.bulkPut(records)
  }

  return records
}

/** 重命名素材并更新修改时间 */
export const renameAttachment = async (id: string, name: string): Promise<void> => {
  await db.attachments.update(id, {
    name,
    updatedAt: new Date().toISOString()
  })
}

/** 按 ID 删除素材 */
export const deleteAttachment = async (id: string): Promise<void> => {
  await db.attachments.delete(id)
}

/** 替换素材的图片数据并重新计算尺寸与类型 */
export const updateAttachmentBlob = async (
  attachment: AttachmentRecordType,
  blob: Blob
): Promise<AttachmentRecordType> => {
  const size = await getBlobImageSize(blob)
  const nextAttachment: AttachmentRecordType = {
    ...attachment,
    blob,
    mimeType: blob.type || attachment.mimeType,
    width: size.width,
    height: size.height,
    size: blob.size,
    updatedAt: new Date().toISOString()
  }

  await db.attachments.put(nextAttachment)
  return nextAttachment
}

/** 按传入的 ID 顺序重写素材的 sortOrder */
export const updateAttachmentOrder = async (attachmentIds: string[]): Promise<void> => {
  const records = await Promise.all(attachmentIds.map((id) => db.attachments.get(id)))
  const nextRecords = records
    .filter((record): record is AttachmentRecordType => record !== undefined)
    .map((record, index) => ({
      ...record,
      sortOrder: index,
      updatedAt: new Date().toISOString()
    }))

  if (nextRecords.length === 0) return

  await db.attachments.bulkPut(nextRecords)
}

/** 用裁剪后的 Base64 图片覆盖素材（保留 PNG 透明或转 JPEG） */
export const updateAttachmentFromCroppedBase64 = async (
  attachment: AttachmentRecordType,
  base64: string
): Promise<AttachmentRecordType> => {
  const outputMimeType = attachment.mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = base64ToBlob(base64, outputMimeType)
  return updateAttachmentBlob(attachment, blob)
}

/** 旋转素材图片 90°（left/right），并写回数据库 */
export const rotateAttachment = async (
  attachment: AttachmentRecordType,
  direction: 'left' | 'right'
): Promise<AttachmentRecordType> => {
  const dataUrl = await blobToDataUrl(attachment.blob)
  const image = new Image()
  image.src = dataUrl
  await image.decode()

  // 旋转后宽高互换，画布先铺白底再绕中心旋转绘制
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalHeight
  canvas.height = image.naturalWidth
  const context = canvas.getContext('2d')
  if (!context) return attachment

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((direction === 'right' ? 90 : -90) * (Math.PI / 180))
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

  const rotatedBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob || attachment.blob), 'image/jpeg', 0.92)
  })

  return updateAttachmentBlob(attachment, rotatedBlob)
}

/** 为素材 Blob 创建临时 object URL，供画布/预览使用 */
export const attachmentToObjectUrl = (attachment: AttachmentRecordType): string => {
  return URL.createObjectURL(attachment.blob)
}
