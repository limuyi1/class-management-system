<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'

import { ElMessage, ElMessageBox } from 'element-plus'
import { pinyin } from 'pinyin-pro'
import { storeToRefs } from 'pinia'
import { parseExcel } from '@/utils/xlsxUntil'
import { importDatabase } from '@/utils/backup'
import ImportProgress from '@/views/setting/components/ImportProgress.vue'
import { NAME_PROP } from '@/types/Constants'

const router = useRouter()
const store = useDataSourceStore()
const settingStore = useSettingStore()
const configuration = useConfigurationStore()
const { tableHeaders } = storeToRefs(settingStore)

const backupInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const progressVisible = ref(false)
const progressTitle = ref('')
const progressPercent = ref(0)

const updateProgress = (percent: number) => {
  progressPercent.value = percent
}

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
      const _headerObj: Record<string, unknown> = Object.assign({ [NAME_PROP]: null }, headerObj)
      _headerObj[NAME_PROP] = e['姓名'] || null
      headerArray.forEach((headerItem: { prop: string; label: string }) => {
        _headerObj[headerItem.prop] = e[headerItem.label] || null
      })
      return _headerObj
    })

    tableHeaders.value = headerArray
    store.$patch({ items: result as any[] })
    configuration.inputScoreTab = headerArray[0]?.prop

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

  if (!file.name.endsWith('.dexie')) {
    ElMessage.error('请选择 .dexie 格式的备份文件')
    target.value = ''
    return
  }

  try {
    await ElMessageBox.confirm('导入将覆盖当前所有数据，确定要继续吗？', '确认导入', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    importing.value = true
    progressTitle.value = '正在导入数据'
    progressPercent.value = 0
    progressVisible.value = true
    await importDatabase(file, updateProgress, () => {
      progressPercent.value = 100
      setTimeout(() => {
        progressVisible.value = false
        router.push('/home')
      }, 500)
    })
  } catch {
    progressVisible.value = false
  } finally {
    importing.value = false
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
        accept=".dexie"
        style="display: none"
        @change="handleBackupImport"
      />
      <div class="upload-hint">
        <p class="hint-section">
          <strong>上传学生信息</strong>：支持 .xls/.xlsx 格式，表格需包含"姓名"列
        </p>
        <p class="hint-section">
          <strong>导入备份</strong>：支持 .dexie 格式，用于恢复系统全量数据（会覆盖当前数据）
        </p>
      </div>
    </div>
  </div>

  <ImportProgress
    v-model:visible="progressVisible"
    :title="progressTitle"
    :percent="progressPercent"
  />
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
