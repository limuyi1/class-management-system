<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'

import { ElMessage } from 'element-plus'
import { pinyin } from 'pinyin-pro'
import { storeToRefs } from 'pinia'
import { parseExcel } from '@/untils/xlsxUntil'

const router = useRouter()
const store = useDataSourceStore()
const settingStore = useSettingStore()
const configuration = useConfigurationStore()
const { data: config } = storeToRefs(configuration)
const { tableHeaders } = storeToRefs(settingStore)

const uploadFile = async (file: any) => {
  try {
    parseExcel(file).then(({ header, data }) => {
      if (!header.includes('姓名')) {
        ElMessage.error('表格中必须包含[姓名]列！')
        return
      }

      const filteredHeader = header.filter((label: string) => label !== '序号' && label !== '姓名')

      const headerArray = filteredHeader.map((label: string) => ({
        prop: pinyin(label, { toneType: 'num', type: 'array' }).join('_'),
        label
      }))

      const headerObj = headerArray.reduce((acc: any, cur: any) => {
        acc[cur.prop] = null
        return acc
      }, {})

      const result = data.map((e: any) => {
        const _headerObj = Object.assign({ xing4_ming2: null }, headerObj)
        _headerObj.xing4_ming2 = e['姓名'] || null
        headerArray.forEach((headerItem) => {
          _headerObj[headerItem.prop] = e[headerItem.label] || null
        })
        return _headerObj
      })

      tableHeaders.value = headerArray
      store.data = result
      config.value.inputScoreTab = headerArray[0]?.prop

      ElMessage.success('导入成功！')
      router.push('/home')
    })
  } catch (err) {
    ElMessage.error('导入失败！')
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
      <p class="empty-description">请上传包含学生信息的 Excel 文件</p>
      <el-upload
        action="#"
        :auto-upload="false"
        :on-change="uploadFile"
        :limit="1"
        :show-file-list="false"
        accept=".xls,.xlsx"
      >
        <el-button type="primary" size="large" class="upload-btn">
          <font-awesome-icon :icon="['solid', 'upload']" class="upload-icon" />
          选择文件
        </el-button>
      </el-upload>
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  color: #667eea;
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
