import { beforeEach, describe, expect, it } from 'vitest'

import { isDatabaseImporting, setDatabaseImporting } from '@/utils/persistDexieImportState'

describe('persistDexieImportState', () => {
  beforeEach(() => {
    setDatabaseImporting(false)
  })

  it('默认不在导入状态', () => {
    expect(isDatabaseImporting()).toBe(false)
  })

  it('设置后可反映导入状态', () => {
    setDatabaseImporting(true)
    expect(isDatabaseImporting()).toBe(true)
  })

  it('可再次重置为非导入状态', () => {
    setDatabaseImporting(true)
    setDatabaseImporting(false)
    expect(isDatabaseImporting()).toBe(false)
  })
})
