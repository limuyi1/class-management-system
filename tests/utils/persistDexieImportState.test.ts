/**
 * 测试 persistDexieImportState 模块。
 * 覆盖：数据库导入状态的默认值、设置与重置。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { isDatabaseImporting, setDatabaseImporting } from '@/utils/persistDexieImportState'

// 数据库导入状态读写测试组
describe('persistDexieImportState', () => {
  // 每个用例前重置为未导入状态，避免用例间相互影响
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
