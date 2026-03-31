import { db } from '@/db'
import { ElMessage } from 'element-plus'

export async function exportDatabase() {
  try {
    const data = {
      formatName: 'scs-database',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      dataSource: await db.dataSource.toArray(),
      wrongBook: await db.wrongBook.toArray(),
      setting: await db.setting.toArray(),
      configuration: await db.configuration.toArray(),
      theme: await db.theme.toArray(),
      aiConfig: await db.aiConfig.toArray()
    }

    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scs-backup-${new Date().toISOString().slice(0, 10)}.json`
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
    const text = await file.text()
    const data = JSON.parse(text)

    if (!data.formatName || data.formatName !== 'scs-database') {
      throw new Error('无效的备份文件')
    }

    await db.transaction('rw', [db.dataSource, db.wrongBook, db.setting, db.configuration, db.theme, db.aiConfig], async () => {
      await db.dataSource.clear()
      await db.wrongBook.clear()
      await db.setting.clear()
      await db.configuration.clear()
      await db.theme.clear()
      await db.aiConfig.clear()

      if (data.dataSource?.length > 0) {
        await db.dataSource.bulkPut(data.dataSource)
      }
      if (data.wrongBook?.length > 0) {
        await db.wrongBook.bulkPut(data.wrongBook)
      }
      if (data.setting?.length > 0) {
        await db.setting.bulkPut(data.setting)
      }
      if (data.configuration?.length > 0) {
        await db.configuration.bulkPut(data.configuration)
      }
      if (data.theme?.length > 0) {
        await db.theme.bulkPut(data.theme)
      }
      if (data.aiConfig?.length > 0) {
        await db.aiConfig.bulkPut(data.aiConfig)
      }
    })

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
