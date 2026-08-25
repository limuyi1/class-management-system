/**
 * 测试 zipUtil 的 createStoredZip。
 * 覆盖：生成含 UTF-8 文件名的合法存储式 ZIP 包（本地文件头与中央目录签名校验）。
 */
import { describe, expect, it } from 'vitest'

import { createStoredZip } from '../../src/utils/zipUtil'

// ZIP 工具函数测试组
describe('zipUtil', () => {
  it('creates a valid stored zip envelope with UTF-8 file names', async () => {
    const blob = await createStoredZip([
      { name: '张明轩.png', data: new Uint8Array([1, 2, 3]) },
      { name: '李雨桐.png', data: new Uint8Array([4, 5]) }
    ])
    const bytes = new Uint8Array(await blob.arrayBuffer())

    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(Array.from(bytes.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06])
    expect(blob.type).toBe('application/zip')
  })
})
