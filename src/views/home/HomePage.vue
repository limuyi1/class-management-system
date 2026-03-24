<script setup lang="tsx">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { ElMessageBox } from 'element-plus'
import { pinyin } from 'pinyin-pro'

import EmptyTableView from '@/views/home/components/EmptyTableView.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

import type { VxeTableEvents, VxeTablePropTypes } from 'vxe-table'
import type { SettingType } from '@/types/Setting'

const store = useDataSourceStore()
const settingStore = useSettingStore()
const { data: tableData } = storeToRefs(store)
const { tableHeaders: headers } = storeToRefs(settingStore)

const tableRef = ref()
const editConfig = ref<VxeTablePropTypes.EditConfig>({
  trigger: 'dblclick',
  mode: 'cell',
  showIcon: false
})
const columnConfig = ref<VxeTablePropTypes.ColumnConfig>({
  drag: true
})
const menuConfig = ref<VxeTablePropTypes.MenuConfig>({
  header: {
    options: [
      [
        {
          prefixIcon: () => <font-awesome-icon icon={['solid', 'plus']} />,
          code: 'addLeft',
          name: '向左添加列'
        },
        {
          prefixIcon: () => <font-awesome-icon icon={['solid', 'plus']} />,
          code: 'addRight',
          name: '向右添加列'
        },
        {
          prefixIcon: () => <font-awesome-icon icon={['solid', 'trash-can']} />,
          code: 'remove',
          name: '删除列'
        }
      ]
    ]
  },
  visibleMethod: ({ columnIndex }) => !isNameColumn(columnIndex as number)
})

const isNotEmpty = computed(() => store.data?.length)

// 重置数据
const repeatIcon = () => <font-awesome-icon icon={['solid', 'repeat']} />

// 判断是否为姓名列（第一列是序号，第二列是姓名）
const isNameColumn = (columnIndex: number) => {
  return columnIndex <= 1
}

// 列拖拽结束
const columnDragendHandle = () => {
  const $table = tableRef.value
  if ($table) {
    const tableColumn = $table.getFullColumns()
    headers.value = tableColumn.splice(2).map((e: any) => ({
      prop: e.field,
      label: e.title
    }))
  }
}

// 菜单点击
const menuClickEvent: VxeTableEvents.MenuClick = ({ menu, column, columnIndex }) => {
  switch (menu.code) {
    case 'addRight':
      ElMessageBox.prompt('请输入列名', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入列名'
      }).then(({ value }) => {
        if (value) {
          headers.value?.splice(columnIndex - 1, 0, {
            prop: pinyin(value, { toneType: 'num', type: 'array' }).join('_'),
            label: value
          })
        }
      })
      break
    case 'addLeft':
      ElMessageBox.prompt('请输入列名', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入列名'
      }).then(({ value }) => {
        if (value) {
          headers.value?.splice(columnIndex - 2, 0, {
            prop: pinyin(value, { toneType: 'num', type: 'array' }).join('_'),
            label: value
          })
        }
      })
      break
    case 'remove':
      ElMessageBox.confirm('确定要删除该列吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        headers.value?.splice(columnIndex - 2, 1)
        tableData.value.forEach((e) => {
          delete e[column.field]
        })
      })
      break
  }
}

// 重置信息
const resetStuInfo = () => {
  ElMessageBox.confirm('确定要重置学生信息吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    // 重置数据
    store.$reset()
    settingStore.$reset()
  })
}
</script>

<template>
  <div class="overflow-hidden h-full w-full" v-if="isNotEmpty">
    <vxe-toolbar>
      <template #buttons>
        <div class="w-full px-4 flex justify-between">
          <el-button type="primary" :icon="repeatIcon" @click="resetStuInfo">上传信息</el-button>
        </div>
      </template>
    </vxe-toolbar>
    <vxe-table
      ref="tableRef"
      border
      show-overflow
      auto-resize
      height="auto"
      align="center"
      :edit-config="editConfig"
      :column-config="columnConfig"
      :menu-config="menuConfig"
      :data="tableData"
      @column-dragend="columnDragendHandle"
      @menu-click="menuClickEvent"
    >
      <!-- 序号列：不可编辑、不可删除、自动生成 -->
      <vxe-column type="seq" title="序号" width="60" fixed="left" :resizable="false" />
      <!-- 姓名列：不可删除、不可排序、可编辑 -->
      <vxe-column
        field="xing4_ming2"
        title="姓名"
        width="100"
        fixed="left"
        sortable
        resizable
        :edit-render="{ name: 'input' }"
      />
      <!-- 其他数据列 -->
      <vxe-column
        v-for="item in headers"
        :key="item.prop"
        :field="item.prop"
        :title="item.label"
        sortable
        resizable
        min-width="150"
        :edit-render="{ name: 'input' }"
      />
    </vxe-table>
  </div>

  <empty-table-view v-else />
</template>

<style scoped lang="scss"></style>
