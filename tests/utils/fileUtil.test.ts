import { describe, expect, it } from 'vitest'

import {
  base64ToBlob,
  dataUrlToBase64,
  estimateCompressedImageSize,
  formatFileSize,
  getBase64ByteSize
} from '@/utils/fileUtil'

describe('dataUrlToBase64', () => {
  it('去除 DataURL 前缀仅保留 Base64 内容', () => {
    expect(dataUrlToBase64('data:image/png;base64,AAAA')).toBe('AAAA')
    expect(dataUrlToBase64('data:image/jpeg;base64,BBBB')).toBe('BBBB')
  })
})

describe('getBase64ByteSize', () => {
  it('无填充时按 4 字符 3 字节换算', () => {
    expect(getBase64ByteSize('AAAA')).toBe(3)
    expect(getBase64ByteSize('AAAAAAAA')).toBe(6)
  })

  it('扣除末尾填充字符', () => {
    expect(getBase64ByteSize('AAA=')).toBe(2)
    expect(getBase64ByteSize('AA==')).toBe(1)
  })

  it('忽略空白字符', () => {
    expect(getBase64ByteSize(' AA AA ')).toBe(3)
  })
})

describe('formatFileSize', () => {
  it('非正数或非法值返回 0kb', () => {
    expect(formatFileSize(0)).toBe('0kb')
    expect(formatFileSize(-1)).toBe('0kb')
    expect(formatFileSize(Number.NaN)).toBe('0kb')
  })

  it('小于 1M 时以 kb 展示', () => {
    expect(formatFileSize(2048)).toBe('2kb')
  })

  it('大于等于 1M 时以 M 展示', () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5M')
  })
})

describe('estimateCompressedImageSize', () => {
  it('不压缩时返回原图体积', () => {
    expect(estimateCompressedImageSize('AAAAAAAA', null)).toBe(6)
  })

  it('按面积比例平方缩放估算体积', () => {
    expect(estimateCompressedImageSize('AAAAAAAA', 0.5)).toBe(2)
  })
})

describe('base64ToBlob', () => {
  it('将 base64 解码为指定 MIME 类型的 Blob', async () => {
    const blob = base64ToBlob('SGVsbG8=', 'text/plain')

    expect(blob.type).toBe('text/plain')
    await expect(blob.text()).resolves.toBe('Hello')
  })
})
