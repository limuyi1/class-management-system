import 'dexie-export-import'
import { db } from '@/db'
import { ElMessage } from 'element-plus'

export async function exportDatabase() {
  try {
    const blob = await db.export()
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

export async function importDatabase(file: File) {
  try {
    await db.import(file)
    ElMessage.success('导入成功，请刷新页面')
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  } catch (error) {
    console.error('Import failed:', error)
    ElMessage.error('导入失败：无效的备份文件')
  }
}

export async function clearDatabase() {
  try {
    await db.dataSource.clear()
    await db.wrongBook.clear()
    await db.setting.clear()
    await db.configuration.clear()
    await db.theme.clear()
    await db.aiConfig.clear()
    ElMessage.success('数据已清空，请刷新页面')
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  } catch (error) {
    console.error('Clear failed:', error)
    ElMessage.error('清空失败')
  }
}
