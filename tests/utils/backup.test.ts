/**
 * backup 工具测试
 * 覆盖导入数据库备份（importDatabase）与计算距上次备份天数（getDaysSinceBackup），
 * 其中 element-plus、各 Pinia store 与数据库模块均被 mock，避免依赖真实持久化环境。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// 消息提示与导入状态设置函数的 mock，用于断言成功/失败提示与导入状态切换
const successMock = vi.fn()
const errorMock = vi.fn()
const setDatabaseImportingMock = vi.fn()

// 各 Pinia store 的 mock 实例，仅保留导入流程会用到的属性与方法
const stores = {
  dataSource: { students: [], isDataReady: false },
  setting: { $patch: vi.fn(), $reset: vi.fn() },
  configuration: { $patch: vi.fn(), $reset: vi.fn() },
  theme: { $patch: vi.fn(), applyTheme: vi.fn(), resetTheme: vi.fn() },
  aiConfig: { $patch: vi.fn(), $reset: vi.fn() },
  wrongBook: { $patch: vi.fn(), $reset: vi.fn() },
  overviewAnalysis: { $patch: vi.fn(), $reset: vi.fn() },
  tools: { $patch: vi.fn(), $reset: vi.fn() },
  scoreNotice: { $patch: vi.fn(), $reset: vi.fn() },
  seatingChart: { $patch: vi.fn(), $reset: vi.fn(), reconcileStudents: vi.fn() },
  dutyRoster: { $patch: vi.fn(), $reset: vi.fn(), reconcileStudents: vi.fn() }
}

// 各数据库表的 get 方法 mock，默认返回 undefined 表示表内容为空
const tableGetMocks = {
  studentDataset: vi.fn(async () => undefined),
  scoreSettings: vi.fn(async () => undefined),
  appPreferences: vi.fn(async () => undefined),
  themePreferences: vi.fn(async () => undefined),
  aiSettings: vi.fn(async () => undefined),
  wrongBook: vi.fn(async () => undefined),
  overviewAnalysisCache: vi.fn(async () => undefined),
  toolPreferences: vi.fn(async () => undefined),
  seatingCharts: vi.fn(async () => undefined),
  dutyRosters: vi.fn(async () => undefined),
  scoreNotice: vi.fn(async () => undefined)
}

// 数据库 import 方法 mock，用于断言导入调用参数
const importMock = vi.fn(async () => undefined)
const allTableClearMock = vi.fn(async () => undefined)

// mock element-plus：以固定时间戳替代 dayjs 格式化，并捕获成功/失败提示
vi.mock('element-plus', () => ({
  ElMessage: {
    success: successMock,
    error: errorMock
  },
  dayjs: () => ({
    format: () => '2026-05-06_12:00:00'
  })
}))

// 以下 mock 替换导入状态工具、各 store 与数据库模块，隔离真实持久化与 IndexedDB 依赖
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

vi.mock('../../src/stores/seating-chart', () => ({
  useSeatingChartStore: vi.fn(() => stores.seatingChart)
}))

vi.mock('../../src/stores/duty-roster', () => ({
  useDutyRosterStore: vi.fn(() => stores.dutyRoster)
}))

vi.mock('../../src/stores/score-notice', () => ({
  useScoreNoticeStore: vi.fn(() => stores.scoreNotice)
}))

vi.mock('../../src/db', () => ({
  DB_ID: 'main',
  db: {
    import: importMock,
    tables: [{ clear: allTableClearMock }],
    studentDataset: { get: tableGetMocks.studentDataset, clear: vi.fn() },
    scoreSettings: { get: tableGetMocks.scoreSettings, clear: vi.fn() },
    appPreferences: { get: tableGetMocks.appPreferences, clear: vi.fn() },
    themePreferences: { get: tableGetMocks.themePreferences, clear: vi.fn() },
    aiSettings: { get: tableGetMocks.aiSettings, clear: vi.fn() },
    wrongBook: { get: tableGetMocks.wrongBook, clear: vi.fn() },
    overviewAnalysisCache: { get: tableGetMocks.overviewAnalysisCache, clear: vi.fn() },
    toolPreferences: { get: tableGetMocks.toolPreferences, clear: vi.fn() },
    seatingCharts: { get: tableGetMocks.seatingCharts, clear: vi.fn() },
    dutyRosters: { get: tableGetMocks.dutyRosters, clear: vi.fn() },
    scoreNotice: { get: tableGetMocks.scoreNotice, clear: vi.fn() },
    attachments: { clear: vi.fn() },
    paperLayoutDrafts: { clear: vi.fn() },
    export: vi.fn()
  }
}))

// 导入备份：验证对旧备份的兼容导入、旧表清理、状态切换与成功提示
describe('importDatabase', () => {
  // 每个用例前重置 mock 调用记录与数据源状态，避免用例间相互影响
  beforeEach(() => {
    vi.clearAllMocks()
    stores.dataSource.students = []
    stores.dataSource.isDataReady = false
  })

  it('should accept version differences when importing old backups', async () => {
    const file = new File(['backup'], 'backup.dexie', { type: 'application/octet-stream' })
    const onProgress = vi.fn()
    const complete = vi.fn()

    const { importDatabase } = await import('../../src/utils/backup')

    await importDatabase(file, onProgress, complete)

    expect(importMock).toHaveBeenCalledTimes(1)
    expect(allTableClearMock).toHaveBeenCalledTimes(1)
    expect(importMock.mock.calls[0]?.[1]).toMatchObject({
      acceptVersionDiff: true,
      acceptMissingTables: true,
      clearTablesBeforeImport: true
    })
    expect(successMock).toHaveBeenCalledWith('导入成功')
    expect(complete).toHaveBeenCalledTimes(1)
    expect(setDatabaseImportingMock).toHaveBeenNthCalledWith(1, true)
    expect(setDatabaseImportingMock).toHaveBeenLastCalledWith(false)
    expect(stores.seatingChart.$reset).toHaveBeenCalledTimes(1)
    expect(stores.dutyRoster.$reset).toHaveBeenCalledTimes(1)
    expect(stores.scoreNotice.$reset).toHaveBeenCalledTimes(1)
  })
})

// 计算距上次备份的天数：从未备份、非法日期返回 null，正常日期返回天数差
describe('getDaysSinceBackup', () => {
  it('returns null when never backed up or the date is invalid', async () => {
    const { getDaysSinceBackup } = await import('../../src/utils/backup')
    expect(getDaysSinceBackup(null)).toBeNull()
    expect(getDaysSinceBackup('not-a-date')).toBeNull()
  })

  it('returns the number of days since the last backup', async () => {
    const { getDaysSinceBackup } = await import('../../src/utils/backup')
    const now = Date.now()
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

    expect(getDaysSinceBackup(threeDaysAgo)).toBe(3)
    expect(getDaysSinceBackup(sevenDaysAgo)).toBe(7)
  })
})
