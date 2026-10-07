import { inflateRawSync } from 'node:zlib'
/** 在解析 XLSX 前验证 ZIP 展开预算，避免小压缩包耗尽整个服务的内存。 */
export function validateExcelArchive(data: Uint8Array): void {
  const bytes = Buffer.from(data)
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Excel 文件超过 8 MB')
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) return
  let end = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (
      bytes.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length
    ) {
      end = offset
      break
    }
  }
  if (end < 0) throw new Error('ZIP 目录缺失')
  const count = bytes.readUInt16LE(end + 10),
    length = bytes.readUInt32LE(end + 12),
    start = bytes.readUInt32LE(end + 16)
  if (
    count > 2000 ||
    start + length > end ||
    bytes.readUInt16LE(end + 4) !== 0 ||
    bytes.readUInt16LE(end + 6) !== 0
  )
    throw new Error('不支持分卷或超大 ZIP')
  let cursor = start,
    total = 0
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('ZIP 目录损坏')
    const flags = bytes.readUInt16LE(cursor + 8),
      method = bytes.readUInt16LE(cursor + 10),
      compressed = bytes.readUInt32LE(cursor + 20),
      size = bytes.readUInt32LE(cursor + 24),
      name = bytes.readUInt16LE(cursor + 28),
      extra = bytes.readUInt16LE(cursor + 30),
      comment = bytes.readUInt16LE(cursor + 32),
      local = bytes.readUInt32LE(cursor + 42)
    total += size
    if (
      flags & 1 ||
      (method !== 0 && method !== 8) ||
      size > 16 * 1024 * 1024 ||
      total > 64 * 1024 * 1024 ||
      local + 30 > start ||
      bytes.readUInt32LE(local) !== 0x04034b50
    )
      throw new Error('ZIP 格式或展开容量超过限制')
    const from = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    if (from + compressed > start) throw new Error('ZIP 内容越界')
    const payload = bytes.subarray(from, from + compressed)
    const expanded =
      method === 0 ? payload : inflateRawSync(payload, { maxOutputLength: Math.max(1, size) })
    if (expanded.length !== size) throw new Error('ZIP 展开大小不一致')
    cursor += 46 + name + extra + comment
  }
  if (cursor !== start + length) throw new Error('ZIP 目录长度不一致')
}
