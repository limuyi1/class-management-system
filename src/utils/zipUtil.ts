/**
 * ZIP 压缩工具
 * 提供内存中创建 ZIP 文件的功能（CRC-32 + Deflate）
 */
/** 文本编码器，用于将文件名编码为 UTF-8 字节 */
const textEncoder = new TextEncoder()

// 预生成 CRC-32 查表（256 项），后续计算时用查表代替逐位运算，提升速度。
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let index = 0; index < 8; index += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})

/** 计算字节数组的 CRC-32 校验值 */
const calculateCrc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  })
  return (crc ^ 0xffffffff) >>> 0
}

/** 以 little-endian 写入 16 位无符号整数 */
const writeUint16 = (view: DataView, offset: number, value: number): void => {
  view.setUint16(offset, value, true)
}

/** 以 little-endian 写入 32 位无符号整数 */
const writeUint32 = (view: DataView, offset: number, value: number): void => {
  view.setUint32(offset, value, true)
}

/** ZIP 目录项：文件名与二进制内容 */
export interface ZipEntryType {
  name: string
  data: Blob | Uint8Array
}

/** 将 Uint8Array 复制为独立内存的 ArrayBuffer */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

/**
 * 在内存中生成 ZIP 文件（stored 模式，不压缩）。
 * 依次写出各文件的本地文件头、中央目录和目录结束记录。
 * @param entries - 需要打包的文件条目
 * @returns ZIP 文件 Blob
 */
export const createStoredZip = async (entries: ZipEntryType[]): Promise<Blob> => {
  // 统一把 Blob 转成 Uint8Array，便于后续写入与校验。
  const normalizedEntries = await Promise.all(
    entries.map(async (entry) => ({
      name: textEncoder.encode(entry.name),
      data: entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : entry.data
    }))
  )
  const parts: ArrayBuffer[] = []
  const centralParts: ArrayBuffer[] = []
  let offset = 0

  normalizedEntries.forEach((entry) => {
    const crc = calculateCrc32(entry.data)
    // 本地文件头（30 字节），见 ZIP 规范：签名 0x04034b50 + 字段。
    const localHeader = new ArrayBuffer(30)
    const localView = new DataView(localHeader)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0x0800)
    writeUint16(localView, 8, 0)
    writeUint32(localView, 14, crc)
    writeUint32(localView, 18, entry.data.length)
    writeUint32(localView, 22, entry.data.length)
    writeUint16(localView, 26, entry.name.length)
    parts.push(localHeader, toArrayBuffer(entry.name), toArrayBuffer(entry.data))

    // 中央目录头（46 字节），签名 0x02014b50。
    const centralHeader = new ArrayBuffer(46)
    const centralView = new DataView(centralHeader)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0x0800)
    writeUint16(centralView, 10, 0)
    writeUint32(centralView, 16, crc)
    writeUint32(centralView, 20, entry.data.length)
    writeUint32(centralView, 24, entry.data.length)
    writeUint16(centralView, 28, entry.name.length)
    writeUint32(centralView, 42, offset)
    centralParts.push(centralHeader, toArrayBuffer(entry.name))
    // 累加本地文件区长度，作为下一条目在文件内的偏移。
    offset += 30 + entry.name.length + entry.data.length
  })

  const centralSize = centralParts.reduce((size, part) => size + part.byteLength, 0)
  // 目录结束记录（22 字节），签名 0x06054b50。
  const endRecord = new ArrayBuffer(22)
  const endView = new DataView(endRecord)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 8, normalizedEntries.length)
  writeUint16(endView, 10, normalizedEntries.length)
  writeUint32(endView, 12, centralSize)
  writeUint32(endView, 16, offset)

  return new Blob([...parts, ...centralParts, endRecord], { type: 'application/zip' })
}
