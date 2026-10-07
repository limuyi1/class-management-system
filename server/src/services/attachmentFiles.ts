import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { BusinessError } from './errors.js'

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const OWNER_ATTACHMENT_BYTES = 512 * 1024 * 1024
const invalid = (): never => {
  throw new BusinessError(400, 'INVALID_IMAGE', '仅支持有效 PNG/JPEG，最大 8 MB、2000 万像素')
}
/** 读取真实图片头，拒绝伪造 MIME、SVG、异常尺寸及明显截断的文件。 */
export function inspectAttachment(
  buffer: Buffer,
  declaredType: string
): {
  hash: string
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
  size: number
} {
  if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) invalid()
  let width = 0,
    height = 0
  let mimeType: 'image/png' | 'image/jpeg'
  if (
    buffer.length >= 45 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    mimeType = 'image/png'
    if (buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') invalid()
    width = buffer.readUInt32BE(16)
    height = buffer.readUInt32BE(20)
    let offset = 8,
      data = false,
      ended = false
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset)
      if (offset + length + 12 > buffer.length) invalid()
      const type = buffer.toString('ascii', offset + 4, offset + 8)
      if (type === 'IDAT') data = true
      offset += length + 12
      if (type === 'IEND') {
        if (length || offset !== buffer.length) invalid()
        ended = true
        break
      }
    }
    if (!data || !ended) invalid()
  } else if (
    buffer.length >= 12 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[buffer.length - 2] === 255 &&
    buffer[buffer.length - 1] === 217
  ) {
    mimeType = 'image/jpeg'
    let offset = 2
    while (offset + 4 < buffer.length) {
      if (buffer[offset++] !== 255) invalid()
      while (buffer[offset] === 255) offset++
      const marker = buffer[offset++]
      if (marker === 218 || marker === 217) break
      const length = buffer.readUInt16BE(offset)
      if (length < 2 || offset + length > buffer.length) invalid()
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) invalid()
        height = buffer.readUInt16BE(offset + 3)
        width = buffer.readUInt16BE(offset + 5)
        break
      }
      offset += length
    }
  } else return invalid()
  if (
    mimeType !== declaredType ||
    !width ||
    !height ||
    width > 10000 ||
    height > 10000 ||
    width * height > 20000000
  )
    invalid()
  return {
    hash: createHash('sha256').update(buffer).digest('hex'),
    mimeType,
    width,
    height,
    size: buffer.length
  }
}
/** 路径只由已经验证的账号 UUID 与服务端摘要构成，绝不拼接用户文件名。 */
function blobPath(directory: string, ownerId: string, hash: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[0-9a-f]{64}$/.test(hash))
    throw new Error('非法存储标识')
  return resolve(directory, ownerId, hash)
}
/** 临时文件与正式文件同目录原子改名；不可变内容不覆盖旧版本。 */
export function storeAttachment(
  directory: string,
  ownerId: string,
  hash: string,
  buffer: Buffer
): void {
  const path = blobPath(directory, ownerId, hash)
  mkdirSync(resolve(directory, ownerId), { recursive: true, mode: 0o700 })
  if (existsSync(path)) {
    if (createHash('sha256').update(readFileSync(path)).digest('hex') !== hash)
      throw new Error('附件文件校验失败')
    return
  }
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, buffer, { flag: 'wx', mode: 0o600 })
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}
/** 下载前校验摘要，磁盘丢失或损坏时明确失败，不伪装成空图片。 */
export function readAttachmentFile(directory: string, ownerId: string, hash: string): Buffer {
  try {
    const buffer = readFileSync(blobPath(directory, ownerId, hash))
    if (createHash('sha256').update(buffer).digest('hex') !== hash) throw new Error('checksum')
    return buffer
  } catch {
    throw new BusinessError(503, 'ATTACHMENT_UNAVAILABLE', '附件文件缺失或损坏，请联系管理员恢复')
  }
}
