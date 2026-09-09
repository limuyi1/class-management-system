import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addFilesToAttachments,
  attachmentToObjectUrl,
  createAttachmentRecordsFromFiles,
  deleteAttachment,
  getAttachments,
  renameAttachment,
  rotateAttachment,
  updateAttachmentBlob,
  updateAttachmentFromCroppedBase64,
  updateAttachmentOrder
} from '@/views/tools/services/attachmentService'

import type { AttachmentRecordType } from '@/types/Tools'

/**
 * attachmentService 服务测试
 * 测试目标：素材库图片存取
 * 覆盖功能：排序读取、图片过滤与 PNG 直通、重名加时间戳、sortOrder 续接与写入、
 * 重命名/删除/顺序重写、裁剪 Base64 回写、旋转写回、object URL 生成
 */

// Dexie 素材表替身
const dbMocks = vi.hoisted(() => ({
  toArray: vi.fn(),
  bulkPut: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  put: vi.fn()
}))
vi.mock('@/db', () => ({
  db: { attachments: dbMocks }
}))

// Image 替身：设置 src 后异步触发 onload，模拟图片解码
class ImageMock {
  naturalWidth = 100
  naturalHeight = 80
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  decode = vi.fn().mockResolvedValue(undefined)

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

/** canvas 2d 上下文替身 */
const canvasContextMocks = vi.hoisted(() => ({
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  fillStyle: ''
}))

/** 构造素材记录 fixture */
const createAttachment = (overrides: Partial<AttachmentRecordType> = {}): AttachmentRecordType => ({
  id: 'a1',
  name: '图1.png',
  mimeType: 'image/png',
  blob: new Blob(['x'], { type: 'image/png' }),
  sortOrder: 0,
  width: 100,
  height: 80,
  size: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

describe('attachmentService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00Z'))
    dbMocks.toArray.mockReset().mockResolvedValue([])
    dbMocks.bulkPut.mockReset().mockResolvedValue(undefined)
    dbMocks.update.mockReset().mockResolvedValue(undefined)
    dbMocks.delete.mockReset().mockResolvedValue(undefined)
    dbMocks.get.mockReset().mockResolvedValue(undefined)
    dbMocks.put.mockReset().mockResolvedValue(undefined)

    vi.stubGlobal('Image', ImageMock)
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:fake-url')
      static revokeObjectURL = vi.fn()
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContextMocks as unknown as CanvasRenderingContext2D
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      callback: BlobCallback
    ) {
      callback(new Blob(['canvas'], { type: 'image/jpeg' }))
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sorts attachments by sortOrder ascending with createdAt descending as tiebreaker', async () => {
    dbMocks.toArray.mockResolvedValue([
      createAttachment({ id: 'c', sortOrder: 2, createdAt: '2026-01-05T00:00:00.000Z' }),
      createAttachment({ id: 'a', sortOrder: undefined as unknown as number, createdAt: '2026-01-03T00:00:00.000Z' }),
      createAttachment({ id: 'b', sortOrder: undefined as unknown as number, createdAt: '2026-01-01T00:00:00.000Z' })
    ])

    const result = await getAttachments()

    expect(result.map((attachment) => attachment.id)).toEqual(['a', 'b', 'c'])
  })

  it('creates records only for image files with PNG passthrough and incremental sortOrder', async () => {
    const pngFile = new File(['png'], '图1.png', { type: 'image/png' })
    const jpegFile = new File(['jpg'], '图2.jpg', { type: 'image/jpeg' })
    const textFile = new File(['text'], '说明.txt', { type: 'text/plain' })

    const records = await createAttachmentRecordsFromFiles([pngFile, textFile, jpegFile], {
      idPrefix: 'att',
      startSortOrder: 5
    })

    expect(records).toHaveLength(2)
    expect(records[0].name).toBe('图1.png')
    expect(records[0].mimeType).toBe('image/png')
    expect(records[0].sortOrder).toBe(5)
    expect(records[1].sortOrder).toBe(6)
    expect(records[0].width).toBe(100)
    expect(records[0].height).toBe(80)
    expect(records[0].id).toMatch(/^att-/)
    expect(records[0].createdAt).toBe(records[0].updatedAt)
    // 未写入数据库
    expect(dbMocks.bulkPut).not.toHaveBeenCalled()
  })

  it('appends a timestamp suffix to duplicate names within the same batch', async () => {
    const first = new File(['png'], '图片.png', { type: 'image/png' })
    const second = new File(['png'], '图片.png', { type: 'image/png' })

    const records = await createAttachmentRecordsFromFiles([first, second])

    expect(records[0].name).toBe('图片.png')
    expect(records[1].name).toBe('图片_20260907_160000.png')
  })

  it('appends a timestamp suffix when the name collides with an existing attachment', async () => {
    const file = new File(['png'], '图片.png', { type: 'image/png' })

    const records = await createAttachmentRecordsFromFiles([file], {
      existingNames: new Set(['图片.png'])
    })

    expect(records[0].name).toBe('图片_20260907_160000.png')
  })

  it('continues sortOrder from the max existing value when adding files', async () => {
    dbMocks.toArray.mockResolvedValue([
      createAttachment({ id: 'a', sortOrder: 2 }),
      createAttachment({ id: 'b', sortOrder: 5 })
    ])
    const file = new File(['png'], '新图.png', { type: 'image/png' })

    const records = await addFilesToAttachments([file])

    expect(records[0].sortOrder).toBe(6)
    expect(dbMocks.bulkPut).toHaveBeenCalledWith(records)
  })

  it('falls back to the record count when legacy data has no sortOrder', async () => {
    dbMocks.toArray.mockResolvedValue([
      createAttachment({ id: 'a', sortOrder: undefined as unknown as number }),
      createAttachment({ id: 'b', sortOrder: undefined as unknown as number })
    ])
    const file = new File(['png'], '新图.png', { type: 'image/png' })

    const records = await addFilesToAttachments([file])

    expect(records[0].sortOrder).toBe(2)
  })

  it('skips database write when adding no valid image files', async () => {
    const records = await addFilesToAttachments([new File(['t'], '说明.txt', { type: 'text/plain' })])

    expect(records).toHaveLength(0)
    expect(dbMocks.bulkPut).not.toHaveBeenCalled()
  })

  it('renames an attachment and refreshes its updatedAt', async () => {
    await renameAttachment('a1', '新名称.png')

    expect(dbMocks.update).toHaveBeenCalledWith('a1', {
      name: '新名称.png',
      updatedAt: '2026-09-07T08:00:00.000Z'
    })
  })

  it('deletes an attachment by id', async () => {
    await deleteAttachment('a1')

    expect(dbMocks.delete).toHaveBeenCalledWith('a1')
  })

  it('rewrites sortOrder based on the given id order', async () => {
    dbMocks.get.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'a1'
          ? createAttachment({ id: 'a1' })
          : id === 'a2'
            ? createAttachment({ id: 'a2' })
            : undefined
      )
    )

    await updateAttachmentOrder(['a2', 'missing', 'a1'])

    const [records] = dbMocks.bulkPut.mock.calls[0]
    expect(records.map((record: AttachmentRecordType) => record.id)).toEqual(['a2', 'a1'])
    expect(records.map((record: AttachmentRecordType) => record.sortOrder)).toEqual([0, 1])
    expect(records[0].updatedAt).toBe('2026-09-07T08:00:00.000Z')
  })

  it('skips database write when no ordered records exist', async () => {
    dbMocks.get.mockResolvedValue(undefined)

    await updateAttachmentOrder(['missing'])

    expect(dbMocks.bulkPut).not.toHaveBeenCalled()
  })

  it('updates an attachment blob and recomputes its dimensions', async () => {
    const attachment = createAttachment()
    const newBlob = new Blob(['new'], { type: 'image/png' })

    const updated = await updateAttachmentBlob(attachment, newBlob)

    expect(updated.blob).toBe(newBlob)
    expect(updated.width).toBe(100)
    expect(updated.height).toBe(80)
    expect(updated.size).toBe(newBlob.size)
    expect(updated.updatedAt).toBe('2026-09-07T08:00:00.000Z')
    expect(dbMocks.put).toHaveBeenCalledWith(updated)
  })

  it('keeps PNG mime type for cropped base64 overwrites', async () => {
    const attachment = createAttachment({ mimeType: 'image/png' })

    const updated = await updateAttachmentFromCroppedBase64(attachment, 'aGVsbG8=')

    expect(updated.mimeType).toBe('image/png')
    expect(dbMocks.put).toHaveBeenCalledWith(updated)
  })

  it('falls back to JPEG mime type for non-PNG cropped overwrites', async () => {
    const attachment = createAttachment({ mimeType: 'image/webp' })

    const updated = await updateAttachmentFromCroppedBase64(attachment, 'aGVsbG8=')

    expect(updated.mimeType).toBe('image/jpeg')
  })

  it('rotates an attachment and writes the rotated blob back', async () => {
    const attachment = createAttachment()

    const rotated = await rotateAttachment(attachment, 'right')

    expect(rotated.blob).toEqual(new Blob(['canvas'], { type: 'image/jpeg' }))
    expect(canvasContextMocks.translate).toHaveBeenCalled()
    expect(canvasContextMocks.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(dbMocks.put).toHaveBeenCalledWith(rotated)
  })

  it('creates an object URL for an attachment blob', () => {
    const attachment = createAttachment()

    const url = attachmentToObjectUrl(attachment)

    expect(url).toBe('blob:fake-url')
  })
})
