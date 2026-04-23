import 'dexie-export-import'
import { db } from '@/db'
import { dayjs, ElMessage } from 'element-plus'
import { useAIConfigStore } from '@/stores/ai-config'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useThemeStore } from '@/stores/theme'
import { useWrongBookStore } from '@/stores/wrong-book'

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

  dataStore.items = []
  dataStore.isInitialLoading = true
  settingStore.$reset()
  configurationStore.$reset()
  aiConfigStore.$reset()
  wrongBookStore.$reset()
  // theme 是 setup store，重置时还需要同步刷新 documentElement 上的主题 CSS 变量。
  themeStore.resetTheme()
}

export async function exportDatabase(onProgress?: (percent: number) => void) {
  try {
    const blob = await db.export({
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
    ElMessage.success('导入成功')
    complete?.()
  } catch (error) {
    console.error('Import failed:', error)
    ElMessage.error(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
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
