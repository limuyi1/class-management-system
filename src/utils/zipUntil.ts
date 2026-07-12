const textEncoder = new TextEncoder()

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let index = 0; index < 8; index += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})

const calculateCrc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  })
  return (crc ^ 0xffffffff) >>> 0
}

const writeUint16 = (view: DataView, offset: number, value: number): void => {
  view.setUint16(offset, value, true)
}

const writeUint32 = (view: DataView, offset: number, value: number): void => {
  view.setUint32(offset, value, true)
}

export interface ZipEntryType {
  name: string
  data: Blob | Uint8Array
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export const createStoredZip = async (entries: ZipEntryType[]): Promise<Blob> => {
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
    offset += 30 + entry.name.length + entry.data.length
  })

  const centralSize = centralParts.reduce((size, part) => size + part.byteLength, 0)
  const endRecord = new ArrayBuffer(22)
  const endView = new DataView(endRecord)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 8, normalizedEntries.length)
  writeUint16(endView, 10, normalizedEntries.length)
  writeUint32(endView, 12, centralSize)
  writeUint32(endView, 16, offset)

  return new Blob([...parts, ...centralParts, endRecord], { type: 'application/zip' })
}
