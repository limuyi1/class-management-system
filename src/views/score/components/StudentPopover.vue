<script setup lang="ts">
import { ElLoading, ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { xlsxToImage } from '@/utils/xlsxUntil'
import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

const store = useDataSourceStore()
const configuration = useConfigurationStore()

const { students: originList } = storeToRefs(store)

type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

interface Props {
  downloadFileName: string
  tagType: TagType
  condition: (student: StudentDataType) => boolean
}

const props = withDefaults(defineProps<Props>(), {
  condition: () => true
})

/**
 * 导出图片
 * @param command
 */
const xlsxToImageCommand = async (command: string) => {
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出图片，请稍后...'
  })
  const result = await xlsxToImage(
    buildData(command === 'exist'),
    `${props.downloadFileName}-${new Date().toLocaleString()}.png`
  )
  loading.close()
  if (!result.success) {
    ElMessage.error(result.error?.message || '导出图片失败')
    return
  }
  ElMessage.success('导出成功')
}

/**
 * 获取数据
 */
const getList = (): StudentDataType[] => {
  if (!configuration.inputScoreTab) return []
  const scoreKey = configuration.inputScoreTab
  return originList.value
    .filter((student) => typeof student[scoreKey] === 'number')
    .filter((student) => props.condition(student))
    .sort((a, b) => {
      const rawScoreA = a[scoreKey]
      const rawScoreB = b[scoreKey]
      const scoreA = typeof rawScoreA === 'number' ? rawScoreA : 0
      const scoreB = typeof rawScoreB === 'number' ? rawScoreB : 0
      return scoreB - scoreA
    })
}

/**
 * 构建数据
 * @param isScore
 */
const buildData = (isScore: boolean = true) => {
  const headerData = isScore ? ['序号', '姓名', '分数'] : ['序号', '姓名']
  const bodyData: Array<Array<string | number | null>> = []

  const data = getList()
  const scoreKey = configuration.inputScoreTab
  data.forEach((student, i: number) => {
    if (isScore) {
      const score =
        scoreKey && typeof student[scoreKey] === 'number' ? Number(student[scoreKey]) : ''
      bodyData.push([String(i + 1), student[NAME_PROP], score])
    } else {
      bodyData.push([String(i + 1), student[NAME_PROP]])
    }
  })

  return [headerData, ...bodyData]
}
</script>

<template>
  <template v-if="getList().length">
    <el-popover placement="top" :width="400" trigger="hover">
      <template #reference>
        <el-text style="cursor: pointer; width: 60px" tag="ins" type="primary">
          <slot :data="getList()">{{ getList().length }} 人</slot>
        </el-text>
      </template>

      <el-badge
        v-for="(item, index) in getList()"
        :key="index"
        style="margin: 0 12px 12px 0"
        :value="configuration.inputScoreTab ? item[configuration.inputScoreTab] : 0"
        :type="props.tagType"
        :max="100"
      >
        <el-tag :type="props.tagType">
          {{ item[NAME_PROP] }}
        </el-tag>
      </el-badge>
    </el-popover>
    <el-dropdown placement="bottom" @command="xlsxToImageCommand">
      <el-button type="primary" size="small" circle>
        <font-awesome-icon :icon="['solid', 'image']" />
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="exist">有分数</el-dropdown-item>
          <el-dropdown-item command="non">无分数</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </template>
  <template v-else>
    <el-text type="primary">/</el-text>
  </template>
</template>

<style scoped lang="scss"></style>
