<script setup lang="ts">
import { computed, ref } from 'vue'

import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { getScoreColor as getScoreColorConfig } from '@/config/score'
import { delay } from '@/utils/commonUntil'
import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

const emit = defineEmits<{
  edit: [row: StudentDataType]
}>()

const store = useDataSourceStore()
const settingStore = useSettingStore()
const configuration = useConfigurationStore()

const { enabledData: tableData } = storeToRefs(store)
const { tableHeaders } = storeToRefs(settingStore)
const tableRef = ref()

const tagTypeList = computed(() => {
  return tableHeaders.value.map((item) => item.prop)
})

/**
 * 获取当前选中列的分数值
 * @param row
 */
const getCurrentScore = (row: StudentDataType): number | null => {
  if (!configuration.inputScoreTab) return null
  const score = row[configuration.inputScoreTab]
  return typeof score === 'number' && Number.isFinite(score) ? score : null
}

/**
 * 获取分数对应的颜色
 * @param score
 */
const getScoreColor = (score: number) => {
  return getScoreColorConfig(score)
}

/**
 * 表格行样式
 * @param row
 */
const getRowStyle = ({ row }: { row: StudentDataType }) => {
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
  const elems = tableRef.value?.$el.querySelectorAll('.el-table__row')
  if (!elems || !elems[index - 1]) return

  const ele = elems[index - 1]
  const classList = ele.classList

  const rowData = tableData.value[index - 1]
  const score = getCurrentScore(rowData)
  const scoreColor = score ? getScoreColor(score) : null
  const originalColor = scoreColor ? scoreColor + '20' : ''

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
 * 重置分数
 */
const resetScore = () => {
  ElMessageBox.confirm('确定要重置分数吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const scoreTab = configuration.inputScoreTab
    if (scoreTab) {
      tableData.value.forEach((e) => {
        e[scoreTab] = null
      })
    }
  })
}

/**
 * 编辑信息
 * @param data
 */
const handleEdit = (data: StudentDataType) => {
  emit('edit', data)
}

defineExpose({ scroll })
</script>

<template>
  <el-table
    ref="tableRef"
    :data="tableData"
    size="large"
    height="calc(100%)"
    border
    :row-style="getRowStyle"
    @row-click="handleEdit"
  >
    <el-table-column type="index" label="序号" width="70" align="center" />
    <el-table-column :prop="NAME_PROP" label="姓名" />
    <el-table-column :prop="configuration.inputScoreTab || ''">
      <template #header>
        <div class="operate-btn__wrapper">
          <el-select
            class="w-[100px]! mr-[8px]"
            v-model="configuration.inputScoreTab"
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
            <font-awesome-icon
              :icon="['fas', 'rotate-right']"
              style="color: var(--el-color-primary); cursor: pointer"
              @click="resetScore"
            />
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
