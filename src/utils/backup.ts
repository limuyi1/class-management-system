import 'dexie-export-import'
import { db } from '@/db'
import { ElMessage } from 'element-plus'

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
    a.download = `scs-backup-${new Date().toISOString().slice(0, 10)}.dexie`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('Export failed:', error)
    ElMessage.error('导出失败')
  }
}

export async function importDatabase(file: File, onProgress?: (percent: number) => void) {
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
    window.location.reload()
  } catch (error) {
    console.error('Import failed:', error)
    ElMessage.error(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
  }
}

export async function clearDatabase(onProgress?: (percent: number) => void) {
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
    onProgress?.(100)
    ElMessage.success('数据已清空')
    window.location.reload()
  } catch (error) {
    console.error('Clear failed:', error)
    ElMessage.error('清空失败')
  }
}
