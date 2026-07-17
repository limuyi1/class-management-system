import 'dexie-export-import'
import { db, DB_ID } from '@/db'
import { DatabaseTableEnum } from '@/db/constants'
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
import { setDatabaseImporting } from '@/utils/persistDexieImportState'
import { normalizeScoreColumns } from '@/utils/settingMigrationUntil'
import { normalizeRecentScoreEntries, normalizeStoredStudents } from '@/utils/studentUntil'

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
  const toolsStore = useToolsStore()
  const seatingChartStore = useSeatingChartStore()
  const dutyRosterStore = useDutyRosterStore()

  dataStore.students = []
  dataStore.isInitialLoading = true
  settingStore.$reset()
  configurationStore.$reset()
  aiConfigStore.$reset()
  wrongBookStore.$reset()
  toolsStore.$reset()
  seatingChartStore.$reset()
  dutyRosterStore.$reset()
  // theme 是 setup store，重置时还需要同步刷新 documentElement 上的主题 CSS 变量。
  themeStore.resetTheme()
}

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
    dutyRosters
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
    db.dutyRosters.get(DB_ID)
  ])

  dataStore.students = normalizeStoredStudents(dataSource?.students)
  dataStore.isInitialLoading = true

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
}

export async function exportDatabase(
  onProgress?: (percent: number) => void,
  includePaperLayout = true
) {
  try {
    const blob = await db.export({
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
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('Export failed:', error)
    ElMessage.error('导出失败')
  }
}

export async function importDatabase(
  file: File,
  onProgress?: (percent: number) => void,
  complete?: () => void
) {
  try {
    const blob = file.slice(0, file.size, 'application/octet-stream')
    setDatabaseImporting(true)
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
    await hydrateRuntimeStores()
    ElMessage.success('导入成功')
    complete?.()
  } catch (error) {
    console.error('Import failed:', error)
    ElMessage.error(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    setDatabaseImporting(false)
  }
}

export async function clearDatabase(onProgress?: (percent: number) => void, complete?: () => void) {
  try {
    await db.studentDataset.clear()
    onProgress?.(15)
    await db.scoreSettings.clear()
    onProgress?.(35)
    await db.appPreferences.clear()
    onProgress?.(45)
    await db.themePreferences.clear()
    onProgress?.(60)
    await db.aiSettings.clear()
    onProgress?.(80)
    await db.wrongBook.clear()
    await db.overviewAnalysisCache.clear()
    await db.attachments.clear()
    await db.paperLayoutDrafts.clear()
    await db.toolPreferences.clear()
    await db.seatingCharts.clear()
    await db.dutyRosters.clear()
    onProgress?.(90)
    resetRuntimeStores()
    onProgress?.(100)
    ElMessage.success('数据已清空')
    complete?.()
  } catch (error) {
    console.error('Clear failed:', error)
    ElMessage.error('清空失败')
  }
}
