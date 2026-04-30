import 'dexie-export-import'
import { db, DB_ID } from '@/db'
import { dayjs, ElMessage } from 'element-plus'
import { useAIConfigStore } from '@/stores/ai-config'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { useTeacherScheduleStore } from '@/stores/teacher-schedule'
import { useSettingStore } from '@/stores/setting'
import { useThemeStore } from '@/stores/theme'
import { useToolsStore } from '@/stores/tools'
import { useWrongBookStore } from '@/stores/wrong-book'
import { setDatabaseImporting } from '@/utils/persistDexieImportState'

const TOOL_TABLES = new Set(['attachments', 'paperLayoutDrafts', 'tools', 'teacherSchedule'])

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
  const teacherScheduleStore = useTeacherScheduleStore()
  const toolsStore = useToolsStore()

  dataStore.items = []
  dataStore.isInitialLoading = true
  settingStore.$reset()
  configurationStore.$reset()
  aiConfigStore.$reset()
  wrongBookStore.$reset()
  teacherScheduleStore.$reset()
  toolsStore.$reset()
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
  const teacherScheduleStore = useTeacherScheduleStore()
  const toolsStore = useToolsStore()

  const [
    dataSource,
    setting,
    configuration,
    theme,
    aiConfig,
    wrongBook,
    overviewAnalysis,
    teacherSchedule,
    tools
  ] =
    await Promise.all([
      db.dataSource.get(DB_ID),
      db.setting.get(DB_ID),
      db.configuration.get(DB_ID),
      db.theme.get(DB_ID),
      db.aiConfig.get(DB_ID),
      db.wrongBook.get(DB_ID),
      db.overviewAnalysis.get(DB_ID),
      db.teacherSchedule.get(DB_ID),
      db.tools.get(DB_ID)
    ])

  dataStore.items = dataSource?.data || []
  dataStore.isInitialLoading = true

  if (setting) {
    const { id, ...state } = setting
    void id
    settingStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (configuration) {
    const { id, ...state } = configuration
    void id
    configurationStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (theme) {
    const { id, ...state } = theme
    void id
    themeStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
    themeStore.applyTheme()
  }
  if (aiConfig) {
    const { id, ...state } = aiConfig
    void id
    aiConfigStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (wrongBook) {
    const { id, ...state } = wrongBook
    void id
    wrongBookStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (overviewAnalysis) {
    const { id, ...state } = overviewAnalysis
    void id
    overviewAnalysisStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (teacherSchedule) {
    const { id, ...state } = teacherSchedule
    void id
    teacherScheduleStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
  }
  if (tools) {
    const { id, ...state } = tools
    void id
    toolsStore.$patch((storeState) => {
      Object.assign(storeState, state)
    })
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
    await db.dataSource.clear()
    onProgress?.(15)
    await db.wrongBook.clear()
    onProgress?.(30)
    await db.setting.clear()
    onProgress?.(45)
    await db.configuration.clear()
    onProgress?.(60)
    await db.theme.clear()
    onProgress?.(80)
    await db.aiConfig.clear()
    await db.teacherSchedule.clear()
    await db.attachments.clear()
    await db.paperLayoutDrafts.clear()
    await db.tools.clear()
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
