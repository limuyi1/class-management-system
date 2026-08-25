/**
 * fileUtil 测试
 * 覆盖文件工具函数：DataURL 解析（dataUrlToBase64）、Base64 字节数估算（getBase64ByteSize）、
 * 文件大小格式化（formatFileSize）、压缩体积估算（estimateCompressedImageSize）与 Base64 转 Blob（base64ToBlob）。
 */

import { describe, expect, it } from 'vitest'

import {
  base64ToBlob,
  dataUrlToBase64,
  estimateCompressedImageSize,
  formatFileSize,
  getBase64ByteSize
} from '@/utils/fileUtil'

// DataURL 解析：去除 DataURL 前缀仅保留 Base64 内容
describe('dataUrlToBase64', () => {
  it('去除 DataURL 前缀仅保留 Base64 内容', () => {
    expect(dataUrlToBase64('data:image/png;base64,AAAA')).toBe('AAAA')
    expect(dataUrlToBase64('data:image/jpeg;base64,BBBB')).toBe('BBBB')
  })
})

// Base64 字节数估算：按 4 字符 3 字节换算，扣除填充字符并忽略空白
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

// 文件大小格式化：非正数或非法值返回 0kb，按 kb/M 分级展示
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

// 压缩体积估算：不压缩时返回原图体积，按面积比例平方缩放估算
describe('estimateCompressedImageSize', () => {
  it('不压缩时返回原图体积', () => {
    expect(estimateCompressedImageSize('AAAAAAAA', null)).toBe(6)
  })

  it('按面积比例平方缩放估算体积', () => {
    expect(estimateCompressedImageSize('AAAAAAAA', 0.5)).toBe(2)
  })
})

// Base64 转 Blob：解码为指定 MIME 类型的 Blob 对象
describe('base64ToBlob', () => {
  it('将 base64 解码为指定 MIME 类型的 Blob', async () => {
    const blob = base64ToBlob('SGVsbG8=', 'text/plain')

    expect(blob.type).toBe('text/plain')
    await expect(blob.text()).resolves.toBe('Hello')
  })
})
