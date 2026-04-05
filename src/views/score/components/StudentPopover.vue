<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { xlsxToImage } from '@/utils/xlsxUntil'
import { NAME_PROP } from '@/types/Constants'

const store = useDataSourceStore()
const configuration = useConfigurationStore()

const { items: originList } = storeToRefs(store)

type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

interface Props {
  downloadFileName: string
  tagType: TagType
  condition: Function
}

const props = withDefaults(defineProps<Props>(), {
  condition: () => {}
})

/**
 * 导出图片
 * @param command
 */
const xlsxToImageCommand = (command: string) => {
  xlsxToImage(
    buildData(command === 'exist'),
    `${props.downloadFileName}-${new Date().toLocaleString()}.png`
  )
}

/**
 * 获取数据
 */
const getList = (): any[] => {
  if (!configuration.inputScoreTab) return []
  const scoreKey = configuration.inputScoreTab
  return originList.value
    .filter((e: any) => e[scoreKey] !== null)
    .filter((e: any) => props.condition(e))
    .sort((a: any, b: any) => (b[scoreKey] || 0) - (a[scoreKey] || 0))
}

/**
 * 构建数据
 * @param isScore
 */
const buildData = (isScore: boolean = true) => {
  const headerData = isScore ? ['序号', '姓名', '分数'] : ['序号', '姓名']
  const bodyData: any[][] = []

  const data = getList()
  const scoreKey = configuration.inputScoreTab
  data.forEach((e: any, i: number) => {
    if (isScore) {
      bodyData.push([String(i + 1), e[NAME_PROP], scoreKey ? e[scoreKey] : ''])
    } else {
      bodyData.push([String(i + 1), e[NAME_PROP]])
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
