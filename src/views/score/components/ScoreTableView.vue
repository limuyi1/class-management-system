<script setup lang="ts">
import { computed, ref } from 'vue'

import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'

const emit = defineEmits(['edit'])

const store = useDataSourceStore()
const settingStore = useSettingStore()
const configuration = useConfigurationStore()

const { data: tableData } = storeToRefs(store)
const { tableHeaders } = storeToRefs(settingStore)
const { data: config } = storeToRefs(configuration)
const tableRef = ref()
const loading = ref(false)

const tagTypeList = computed(() => {
  return tableHeaders.value.map((item) => item.prop)
})

const scoreColorMap = [
  { min: 90, max: 100, color: '#22c55e' },
  { min: 80, max: 89, color: '#3b82f6' },
  { min: 70, max: 79, color: '#eab308' },
  { min: 60, max: 69, color: '#f97316' },
  { min: 50, max: 59, color: '#ef4444' },
  { min: 40, max: 49, color: '#dc2626' },
  { min: 30, max: 39, color: '#b91c1c' },
  { min: 20, max: 29, color: '#991b1b' },
  { min: 10, max: 19, color: '#7f1d1d' },
  { min: 0, max: 9, color: '#450a0a' }
]

/**
 * 获取当前选中列的分数值
 * @param row
 */
const getCurrentScore = (row: any) => {
  if (!config.value.inputScoreTab) return null
  return row[config.value.inputScoreTab]
}

/**
 * 获取分数对应的颜色
 * @param score
 */
const getScoreColor = (score: number) => {
  const range = scoreColorMap.find((r) => score >= r.min && score <= r.max)
  return range?.color
}

/**
 * 表格行样式
 * @param row
 */
const getRowStyle = ({ row }: { row: any }) => {
  const score = getCurrentScore(row)
  if (!score) return {}
  const color = getScoreColor(score)
  if (!color) return {}
  return {
    backgroundColor: color + '20'
  }
}

/**
 * 滚动到指定行
 * @param index
 */
const scroll = (index: number) => {
  tableRef.value?.scrollTo(0, 50 * (index - 1))

  rowBlink(index)
}

/**
 * 行闪烁
 * @param index
 */
const rowBlink = async (index: number) => {
  // 滚动到此行上后颜色闪烁
  const elems = document.querySelectorAll('.el-table__row')
  const ele: any = elems[index - 1]
  const classList = ele.classList

  // 获取当前行的分数颜色
  const rowData = tableData.value[index - 1]
  const score = getCurrentScore(rowData)
  const scoreColor = score ? getScoreColor(score) : null
  const originalColor = scoreColor ? scoreColor + '20' : ''

  // 行颜色已存在的闪烁
  if (classList.length > 1) {
    const backupClass = classList[1]

    for (let i = 0; i < 6; i++) {
      if (backupClass === classList[1]) {
        classList.remove(backupClass)
      } else {
        classList.add(backupClass)
      }
      await delay(300)
    }
  } else {
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) {
        ele.style.backgroundColor = '#f5f7fa'
      } else {
        ele.style.backgroundColor = originalColor
      }
      await delay(300)
    }
  }
}

/**
 * 等待函数
 * @param ms
 */
const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 重置分数
 */
const resetScore = () => {
  ElMessageBox.confirm('确定要重置分数吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    if (config.value.inputScoreTab) {
      tableData.value.forEach((e: any) => {
        e[config.value.inputScoreTab] = null
      })
    }
  })
}

/**
 * 编辑信息
 * @param data
 */
const handleEdit = (data: any) => {
  emit('edit', data)
}

defineExpose({ scroll })
</script>

<template>
  <el-table
    ref="tableRef"
    v-loading="loading"
    :data="tableData"
    size="large"
    height="calc(100%)"
    border
    :row-style="getRowStyle"
    @row-click="handleEdit"
  >
    <el-table-column type="index" label="序号" width="70" align="center" />
    <el-table-column prop="xing4_ming2" label="姓名" />
    <el-table-column :prop="config.inputScoreTab">
      <template #header>
        <div class="operate-btn__wrapper">
          <el-select
            class="w-[100px]! mr-[8px]"
            v-model="config.inputScoreTab"
            placeholder="选择类型"
          >
            <el-option
              v-for="item in tagTypeList"
              :key="item"
              :label="tableHeaders.find((h) => h.prop === item)?.label || item"
              :value="item"
            />
          </el-select>
          <el-tooltip effect="dark" placement="top" append-to="body" content="重置分数">
            <el-icon :size="18" color="var(--el-color-primary)">
              <Refresh style="cursor: pointer" @click="resetScore" />
            </el-icon>
          </el-tooltip>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped lang="scss">
.operate-btn__wrapper {
  display: flex;
  align-items: center;
}

:deep(.el-table__row) {
  height: 50px;
}
</style>
