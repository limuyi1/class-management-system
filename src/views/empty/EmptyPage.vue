<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { useAIConfigStore } from '@/stores/ai-config'
import { useThemeStore } from '@/stores/theme'

import { ElMessage } from 'element-plus'
import { pinyin } from 'pinyin-pro'
import { storeToRefs } from 'pinia'
import { parseExcel } from '@/utils/xlsxUntil'

interface BackupData {
  version: number
  setting: { tableHeaders: any[]; tagCategory: any[]; tags: Record<string, string[]> }
  dataSource: { data: any[] }
  configuration: any
  aiConfig: {
    modelType: string
    model: string
    apiKey: string
    baseUrl: string
    prompts: any
    availableModels: string[]
  }
  theme: { currentTheme: string }
}

const router = useRouter()
const store = useDataSourceStore()
const settingStore = useSettingStore()
const configuration = useConfigurationStore()
const aiConfigStore = useAIConfigStore()
const themeStore = useThemeStore()
const { data: config } = storeToRefs(configuration)
const { tableHeaders, tagCategory, tags } = storeToRefs(settingStore)
const { data } = storeToRefs(store)

const backupInput = ref<HTMLInputElement | null>(null)

const uploadFile = async (file: any) => {
  try {
    const { header, data } = await parseExcel(file)

    if (!header.includes('姓名')) {
      ElMessage.error('表格中必须包含[姓名]列！')
      return
    }

    const filteredHeader = header.filter((label: string) => label !== '序号' && label !== '姓名')

    const headerArray = filteredHeader.map((label: string) => ({
      prop: pinyin(label, { toneType: 'num', type: 'array' }).join('_'),
      label
    }))

    const headerObj: Record<string, unknown> = headerArray.reduce(
      (acc, cur) => {
        acc[cur.prop] = null
        return acc
      },
      {} as Record<string, unknown>
    )

    const result = data.map((e: any) => {
      const _headerObj: Record<string, unknown> = Object.assign({ xing4_ming2: null }, headerObj)
      _headerObj.xing4_ming2 = e['姓名'] || null
      headerArray.forEach((headerItem: { prop: string; label: string }) => {
        _headerObj[headerItem.prop] = e[headerItem.label] || null
      })
      return _headerObj
    })

    tableHeaders.value = headerArray
    store.data = result
    config.value.inputScoreTab = headerArray[0]?.prop

    ElMessage.success('导入成功！')
    router.push('/home')
  } catch (err) {
    ElMessage.error('导入失败！')
  }
}

const triggerBackupImport = () => {
  backupInput.value?.click()
}

const handleBackupImport = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const backup = JSON.parse(text) as BackupData

    if (!backup.version || !backup.setting || !backup.dataSource) {
      ElMessage.error('无效的备份文件格式')
      return
    }

    tableHeaders.value = backup.setting.tableHeaders
    tagCategory.value = backup.setting.tagCategory
    tags.value = backup.setting.tags

    data.value = backup.dataSource.data

    config.value = backup.configuration.data

    aiConfigStore.modelType = backup.aiConfig.modelType as any
    aiConfigStore.model = backup.aiConfig.model
    aiConfigStore.apiKey = backup.aiConfig.apiKey
    aiConfigStore.baseUrl = backup.aiConfig.baseUrl
    aiConfigStore.prompts = backup.aiConfig.prompts
    aiConfigStore.availableModels = backup.aiConfig.availableModels

    themeStore.setTheme(backup.theme.currentTheme as any)

    ElMessage.success('导入成功！')
    router.push('/home')
  } catch (err) {
    ElMessage.error('解析文件失败，请确保是有效的 JSON 备份文件')
  } finally {
    target.value = ''
  }
}
</script>

<template>
  <div class="empty-page">
    <div class="empty-content">
      <div class="empty-icon">
        <font-awesome-icon :icon="['solid', 'user-graduate']" />
      </div>
      <h2 class="empty-title">请上传学生信息</h2>
      <p class="empty-description">请上传包含学生信息的 Excel 文件或直接导入备份文件</p>
      <div class="button-group">
        <el-upload
          action="#"
          :auto-upload="false"
          :on-change="uploadFile"
          :limit="1"
          :show-file-list="false"
          accept=".xls,.xlsx"
        >
          <el-button type="primary" size="large" class="upload-btn">
            <template #icon
              ><font-awesome-icon :icon="['solid', 'upload']" class="upload-icon"
            /></template>
            上传学生信息
          </el-button>
        </el-upload>
        <el-button type="success" size="large" class="upload-btn" @click="triggerBackupImport">
          <template #icon
            ><font-awesome-icon :icon="['solid', 'file-import']" class="upload-icon"
          /></template>
          导入备份
        </el-button>
      </div>
      <input
        ref="backupInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleBackupImport"
      />
      <div class="upload-hint">
        <p>支持 .xls 和 .xlsx 格式</p>
        <p>表格中必须包含"姓名"列</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.empty-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-gradient);
}

.empty-content {
  text-align: center;
  background: #fff;
  padding: 60px 80px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.empty-icon {
  font-size: 80px;
  color: var(--theme-primary);
  margin-bottom: 24px;
}

.empty-title {
  font-size: 28px;
  color: #333;
  margin: 0 0 12px 0;
  font-weight: 600;
}

.empty-description {
  font-size: 16px;
  color: #666;
  margin: 0 0 32px 0;
}

.button-group {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
}

.upload-btn {
  padding: 20px 40px;
  font-size: 16px;
  margin-bottom: 24px;
}

.upload-icon {
  margin-right: 8px;
}

.upload-hint {
  p {
    font-size: 14px;
    color: #999;
    margin: 4px 0;
  }
}
</style>
