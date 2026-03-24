<script setup lang="ts">
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

import { ElMessage } from 'element-plus'
import { pinyin } from 'pinyin-pro'

import { storeToRefs } from 'pinia'

import { parseExcel } from '@/untils/xlsxUntil'
import { useConfigurationStore } from '@/stores/configuration'

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

      // 过滤掉序号列，姓名列固定为 xing4_ming2
      const filteredHeader = header.filter((label: string) => label !== '序号' && label !== '姓名')

      // 将 header 转换为 SettingType[] 格式（不含姓名）
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
        // 设置姓名
        _headerObj.xing4_ming2 = e['姓名'] || null
        // 设置其他列
        headerArray.forEach((headerItem) => {
          _headerObj[headerItem.prop] = e[headerItem.label] || null
        })
        return _headerObj
      })

      // 姓名列始终在第一位，其他列在后面
      tableHeaders.value = headerArray

      store.data = result

      // 添加默认的录入成绩页签（跳过姓名列）
      config.value.inputScoreTab = headerArray[0]?.prop

      ElMessage.success('导入成功！')
    })
  } catch (err) {
    ElMessage.error('导入失败！')
  }
}
</script>

<template>
  <div class="empty-table-view__wrapper">
    <el-card class="empty-table-view-card__wrapper">
      <template #header>还没有学生信息</template>

      <el-upload
        action="#"
        :auto-upload="false"
        :on-change="uploadFile"
        :limit="1"
        :show-file-list="false"
        accept=".xls,.xlsx"
      >
        <el-button type="primary" size="large" style="width: 150px">
          立 即 导 入 <el-icon class="el-icon--right"><Upload /></el-icon>
        </el-button>
      </el-upload>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.empty-table-view__wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  .empty-table-view-card__wrapper {
    height: 220px;
    width: 360px;
  }
}

:deep(.el-card__body) {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
}
</style>
