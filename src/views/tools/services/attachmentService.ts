import { db } from '@/db'
import { base64ToBlob, blobToDataUrl, fileToBlob } from '@/utils/fileUntil'
import type { AttachmentRecordType } from '@/types/Tools'

const createId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

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

const appendTimestampToFileName = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) {
    return `${fileName}_${getTimestampSuffix()}`
  }

  return `${fileName.slice(0, dotIndex)}_${getTimestampSuffix()}${fileName.slice(dotIndex)}`
}

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

const getBlobImageSize = async (blob: Blob): Promise<{ width: number; height: number }> => {
  const url = URL.createObjectURL(blob)
  try {
    return await getImageSize(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

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

export const getAttachments = async (): Promise<AttachmentRecordType[]> => {
  const records = await db.attachments.toArray()
  return records.sort((first, second) => {
    const firstOrder = first.sortOrder ?? 0
    const secondOrder = second.sortOrder ?? 0
    if (firstOrder !== secondOrder) return firstOrder - secondOrder

    return second.createdAt.localeCompare(first.createdAt)
  })
}

export const addFilesToAttachments = async (files: File[]): Promise<AttachmentRecordType[]> => {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  const existingAttachments = await getAttachments()
  const existingNames = new Set(existingAttachments.map((attachment) => attachment.name))
  const hasSortOrder = existingAttachments.some((attachment) => typeof attachment.sortOrder === 'number')
  let nextSortOrder = hasSortOrder
    ? existingAttachments.reduce(
        (maxOrder, attachment) => Math.max(maxOrder, attachment.sortOrder ?? -1),
        -1
      ) + 1
    : existingAttachments.length
  const nextNames = new Set<string>()
  const records = await Promise.all(
    imageFiles.map(async (file) => {
      const blob = await normalizeImageBlob(file)
      const size = await getBlobImageSize(blob)
      const now = new Date().toISOString()
      const duplicateName = existingNames.has(file.name) || nextNames.has(file.name)
      const name = duplicateName ? appendTimestampToFileName(file.name) : file.name
      nextNames.add(name)

      return {
        id: createId('attachment'),
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

  if (records.length > 0) {
    await db.attachments.bulkPut(records)
  }

  return records
}

export const renameAttachment = async (id: string, name: string): Promise<void> => {
  await db.attachments.update(id, {
    name,
    updatedAt: new Date().toISOString()
  })
}

export const deleteAttachment = async (id: string): Promise<void> => {
  await db.attachments.delete(id)
}

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

export const updateAttachmentFromCroppedBase64 = async (
  attachment: AttachmentRecordType,
  base64: string
): Promise<AttachmentRecordType> => {
  const outputMimeType = attachment.mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = base64ToBlob(base64, outputMimeType)
  return updateAttachmentBlob(attachment, blob)
}

export const rotateAttachment = async (
  attachment: AttachmentRecordType,
  direction: 'left' | 'right'
): Promise<AttachmentRecordType> => {
  const dataUrl = await blobToDataUrl(attachment.blob)
  const image = new Image()
  image.src = dataUrl
  await image.decode()

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

export const attachmentToObjectUrl = (attachment: AttachmentRecordType): string => {
  return URL.createObjectURL(attachment.blob)
}
