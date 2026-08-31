/**
 * 数据库备份工具
 * 提供数据库导出、导入与清空，并在操作后同步各运行时 Store
 */
import 'dexie-export-import'
import { db, DB_ID } from '@/db'
import { DatabaseTableEnum } from '@/constants'
import { dayjs, ElMessage } from 'element-plus'
import { useAIConfigStore } from '@/stores/ai-config'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { useSettingStore } from '@/stores/setting'
import { useThemeStore } from '@/stores/theme'
import { useToolsStore } from '@/stores/tools'
import { useWrongBookStore } from '@/stores/wrong-book'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { setDatabaseImporting } from '@/utils/persistDexieImportState'
import { normalizeScoreColumns } from '@/utils/settingMigrationUtil'
import { normalizeRecentScoreEntries, normalizeStoredStudents } from '@/utils/studentUtil'

/** 可选导出的工具类数据表，仅在选择包含工具数据时一并导出 */
const TOOL_TABLES = new Set<string>([
  DatabaseTableEnum.Attachments,
  DatabaseTableEnum.PaperLayoutDrafts,
  DatabaseTableEnum.ToolPreferences
])

/**
 * 清空 IndexedDB 只会删除持久化记录，不会自动重置当前页面已经加载的 Pinia 内存状态。
 * 如果不手动恢复默认值，主题、配置等状态会继续留在页面上，甚至可能被订阅重新写回数据库。
 */
const resetRuntimeStores = () => {
  const dataStore = useDataSourceStore()
  const settingStore = useSettingStore()
  const configurationStore = useConfigurationStore()
  const themeStore = useThemeStore()
  const aiConfigStore = useAIConfigStore()
  const wrongBookStore = useWrongBookStore()
  const overviewAnalysisStore = useOverviewAnalysisStore()
  const toolsStore = useToolsStore()
  const scoreNoticeStore = useScoreNoticeStore()
  const seatingChartStore = useSeatingChartStore()
  const dutyRosterStore = useDutyRosterStore()

  dataStore.students = []
  dataStore.isDataReady = true
  dataStore.initError = null
  settingStore.$reset()
  configurationStore.$reset()
  aiConfigStore.$reset()
  wrongBookStore.$reset()
  overviewAnalysisStore.$reset()
  toolsStore.$reset()
  scoreNoticeStore.$reset()
  seatingChartStore.$reset()
  dutyRosterStore.$reset()
  // theme 是 setup store，重置时还需要同步刷新 documentElement 上的主题 CSS 变量。
  themeStore.resetTheme()
}

/**
 * 导入后把 IndexedDB 中的持久化数据重新灌入各 Pinia 内存 Store。
 * 迁移逻辑（如补齐 disabled 字段、studentId 校验）与首次加载保持一致。
 */
const hydrateRuntimeStores = async () => {
  const dataStore = useDataSourceStore()
  const settingStore = useSettingStore()
  const configurationStore = useConfigurationStore()
  const themeStore = useThemeStore()
  const aiConfigStore = useAIConfigStore()
  const wrongBookStore = useWrongBookStore()
  const overviewAnalysisStore = useOverviewAnalysisStore()
  const toolsStore = useToolsStore()
  const seatingChartStore = useSeatingChartStore()
  const dutyRosterStore = useDutyRosterStore()
  const scoreNoticeStore = useScoreNoticeStore()

  const [
    dataSource,
    setting,
    configuration,
    theme,
    aiConfig,
    wrongBook,
    overviewAnalysis,
    tools,
    seatingCharts,
    dutyRosters,
    scoreNotice
  ] = await Promise.all([
    db.studentDataset.get(DB_ID),
    db.scoreSettings.get(DB_ID),
    db.appPreferences.get(DB_ID),
    db.themePreferences.get(DB_ID),
    db.aiSettings.get(DB_ID),
    db.wrongBook.get(DB_ID),
    db.overviewAnalysisCache.get(DB_ID),
    db.toolPreferences.get(DB_ID),
    db.seatingCharts.get(DB_ID),
    db.dutyRosters.get(DB_ID),
    db.scoreNotice.get(DB_ID)
  ])

  dataStore.students = normalizeStoredStudents(dataSource?.students)
  dataStore.isDataReady = true
  dataStore.initError = null

  if (setting) {
    const { id, updatedAt, ...state } = setting
    void id
    void updatedAt
    state.scoreColumns = normalizeScoreColumns(state.scoreColumns)
    settingStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (configuration) {
    const { id, updatedAt, ...state } = configuration
    void id
    void updatedAt
    state.recentScoreEntries = normalizeRecentScoreEntries(state.recentScoreEntries)
    configurationStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (theme) {
    const { id, updatedAt, ...state } = theme
    void id
    void updatedAt
    themeStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
    themeStore.applyTheme()
  }
  if (aiConfig) {
    const { id, updatedAt, ...state } = aiConfig
    void id
    void updatedAt
    aiConfigStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (wrongBook) {
    const { id, updatedAt, ...state } = wrongBook
    void id
    void updatedAt
    wrongBookStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (overviewAnalysis) {
    const { id, updatedAt, ...state } = overviewAnalysis
    void id
    void updatedAt
    overviewAnalysisStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (tools) {
    const { id, updatedAt, ...state } = tools
    void id
    void updatedAt
    toolsStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (seatingCharts) {
    const { id, updatedAt, ...state } = seatingCharts
    void id
    void updatedAt
    seatingChartStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
    seatingChartStore.reconcileStudents()
  }
  if (dutyRosters) {
    const { id, updatedAt, ...state } = dutyRosters
    void id
    void updatedAt
    dutyRosterStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
    dutyRosterStore.reconcileStudents()
  }
  if (scoreNotice) {
    const { id, updatedAt, ...state } = scoreNotice
    void id
    void updatedAt
    scoreNoticeStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
}

/**
 * 计算距离上次备份的天数。
 * @param lastBackupAt - 上次备份时间（ISO 格式），null 表示从未备份
 * @returns 距今整数天数；null 表示从未备份或时间无效
 */
export function getDaysSinceBackup(lastBackupAt: string | null): number | null {
  if (!lastBackupAt) return null
  const lastTime = new Date(lastBackupAt).getTime()
  if (Number.isNaN(lastTime)) return null
  return Math.floor((Date.now() - lastTime) / (1000 * 60 * 60 * 24))
}

/**
 * 导出全部数据库为 .dexie 备份文件并触发下载。
 * @param onProgress - 进度回调，传入 0-100 的百分比
 * @param includePaperLayout - 是否包含工具类数据表；完整系统备份保持默认 true
 * @returns Promise，成功时触发下载并提示，失败时弹出错误提示
 */
export async function exportDatabase(
  onProgress?: (percent: number) => void,
  includePaperLayout = true
) {
  try {
    const blob = await db.export({
      // 不包含工具表时，过滤掉附件、试卷版式草稿等临时数据。
      filter: (table) => {
        if (includePaperLayout) return true
        return !TOOL_TABLES.has(table)
      },
      progressCallback: (info) => {
        if (onProgress && info.totalRows !== undefined && info.totalRows > 0) {
          const percent = (info.completedRows / info.totalRows) * 100
          onProgress(Math.round(percent))
        }
        return true
      }
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scs-backup-${dayjs().format('YYYY-MM-DD_HH:mm:ss')}.dexie`
    a.click()
    URL.revokeObjectURL(url)
    useConfigurationStore().lastBackupAt = new Date().toISOString()
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('Export failed:', error)
    ElMessage.error('导出失败')
  }
}

/**
 * 导入 .dexie 备份文件，清空现有表后写入数据，并重新灌入内存 Store。
 * @param file - 备份文件
 * @param onProgress - 进度回调，传入 0-100 的百分比
 * @param complete - 导入成功后的回调
 * @returns Promise，导入成功后重新灌入内存 Store 并回调 complete
 */
export async function importDatabase(
  file: File,
  onProgress?: (percent: number) => void,
  complete?: () => void
) {
  try {
    // 复制为独立 Blob，避免文件对象被复用导致读取位置偏移。
    const blob = file.slice(0, file.size, 'application/octet-stream')
    setDatabaseImporting(true)
    // 先清空当前版本的全部表，确保旧备份缺失的新表不会残留导入前的数据。
    await Promise.all(db.tables.map((table) => table.clear()))
    // 兼容不同版本与缺失表，导入后再统一灌入运行时 Store。
    await db.import(blob, {
      acceptVersionDiff: true,
      acceptMissingTables: true,
      clearTablesBeforeImport: true,
      progressCallback: (info) => {
        if (onProgress && info.totalRows !== undefined && info.totalRows > 0) {
          const percent = (info.completedRows / info.totalRows) * 100
          onProgress(Math.round(percent))
        }
        return true
      }
    })
    // 先恢复全部 Store 默认值，旧备份缺失的模块因此保持空状态而不会残留旧内存数据。
    resetRuntimeStores()
    await hydrateRuntimeStores()
    ElMessage.success('导入成功')
    complete?.()
  } catch (error) {
    console.error('Import failed:', error)
    try {
      resetRuntimeStores()
      await hydrateRuntimeStores()
    } catch (hydrateError) {
      console.error('Failed to synchronize stores after import error:', hydrateError)
    }
    ElMessage.error(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    setDatabaseImporting(false)
  }
}

/**
 * 清空所有数据库表并重置运行时 Store 到默认状态。
 * @param onProgress - 进度回调，传入 0-100 的百分比
 * @param complete - 清空完成后的回调
 * @returns Promise，清空数据库并重置运行时 Store
 */
export async function clearDatabase(onProgress?: (percent: number) => void, complete?: () => void) {
  try {
    const tables = db.tables
    for (let index = 0; index < tables.length; index += 1) {
      await tables[index].clear()
      onProgress?.(Math.round(((index + 1) / Math.max(1, tables.length)) * 90))
    }
    resetRuntimeStores()
    onProgress?.(100)
    ElMessage.success('数据已清空')
    complete?.()
  } catch (error) {
    console.error('Clear failed:', error)
    ElMessage.error('清空失败')
  }
}
