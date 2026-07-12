import { describe, expect, it } from 'vitest'

import { createStoredZip } from '../../src/utils/zipUntil'

describe('zipUntil', () => {
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
