import { beforeEach, describe, expect, it, vi } from 'vitest'

const successMock = vi.fn()
const errorMock = vi.fn()
const setDatabaseImportingMock = vi.fn()

const stores = {
  dataSource: { items: [], isInitialLoading: false },
  setting: { $patch: vi.fn(), $reset: vi.fn() },
  configuration: { $patch: vi.fn(), $reset: vi.fn() },
  theme: { $patch: vi.fn(), applyTheme: vi.fn(), resetTheme: vi.fn() },
  aiConfig: { $patch: vi.fn(), $reset: vi.fn() },
  wrongBook: { $patch: vi.fn(), $reset: vi.fn() },
  overviewAnalysis: { $patch: vi.fn() },
  tools: { $patch: vi.fn(), $reset: vi.fn() }
}

const tableGetMocks = {
  dataSource: vi.fn(async () => undefined),
  setting: vi.fn(async () => undefined),
  configuration: vi.fn(async () => undefined),
  theme: vi.fn(async () => undefined),
  aiConfig: vi.fn(async () => undefined),
  wrongBook: vi.fn(async () => undefined),
  overviewAnalysis: vi.fn(async () => undefined),
  tools: vi.fn(async () => undefined)
}

const importMock = vi.fn(async () => undefined)

vi.mock('element-plus', () => ({
  ElMessage: {
    success: successMock,
    error: errorMock
  },
  dayjs: () => ({
    format: () => '2026-05-06_12:00:00'
  })
}))

vi.mock('../../src/utils/persistDexieImportState', () => ({
  setDatabaseImporting: setDatabaseImportingMock
}))

vi.mock('../../src/stores/data-source', () => ({
  useDataSourceStore: vi.fn(() => stores.dataSource)
}))

vi.mock('../../src/stores/setting', () => ({
  useSettingStore: vi.fn(() => stores.setting)
}))

vi.mock('../../src/stores/configuration', () => ({
  useConfigurationStore: vi.fn(() => stores.configuration)
}))

vi.mock('../../src/stores/theme', () => ({
  useThemeStore: vi.fn(() => stores.theme)
}))

vi.mock('../../src/stores/ai-config', () => ({
  useAIConfigStore: vi.fn(() => stores.aiConfig)
}))

vi.mock('../../src/stores/wrong-book', () => ({
  useWrongBookStore: vi.fn(() => stores.wrongBook)
}))

vi.mock('../../src/stores/overview-analysis', () => ({
  useOverviewAnalysisStore: vi.fn(() => stores.overviewAnalysis)
}))

vi.mock('../../src/stores/tools', () => ({
  useToolsStore: vi.fn(() => stores.tools)
}))

vi.mock('../../src/db', () => ({
  DB_ID: 'main',
  db: {
    import: importMock,
    dataSource: { get: tableGetMocks.dataSource, clear: vi.fn() },
    setting: { get: tableGetMocks.setting, clear: vi.fn() },
    configuration: { get: tableGetMocks.configuration, clear: vi.fn() },
    theme: { get: tableGetMocks.theme, clear: vi.fn() },
    aiConfig: { get: tableGetMocks.aiConfig, clear: vi.fn() },
    wrongBook: { get: tableGetMocks.wrongBook, clear: vi.fn() },
    overviewAnalysis: { get: tableGetMocks.overviewAnalysis, clear: vi.fn() },
    tools: { get: tableGetMocks.tools, clear: vi.fn() },
    attachments: { clear: vi.fn() },
    paperLayoutDrafts: { clear: vi.fn() },
    export: vi.fn()
  }
}))

describe('importDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stores.dataSource.items = []
    stores.dataSource.isInitialLoading = false
  })

  it('should accept version differences when importing old backups', async () => {
    const file = new File(['backup'], 'backup.dexie', { type: 'application/octet-stream' })
    const onProgress = vi.fn()
    const complete = vi.fn()

    const { importDatabase } = await import('../../src/utils/backup')

    await importDatabase(file, onProgress, complete)

    expect(importMock).toHaveBeenCalledTimes(1)
    expect(importMock.mock.calls[0]?.[1]).toMatchObject({
      acceptVersionDiff: true,
      acceptMissingTables: true,
      clearTablesBeforeImport: true
    })
    expect(successMock).toHaveBeenCalledWith('导入成功')
    expect(complete).toHaveBeenCalledTimes(1)
    expect(setDatabaseImportingMock).toHaveBeenNthCalledWith(1, true)
    expect(setDatabaseImportingMock).toHaveBeenLastCalledWith(false)
  })
})
