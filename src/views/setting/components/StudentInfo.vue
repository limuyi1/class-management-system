<script setup lang="tsx">
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'

import { ElMessageBox } from 'element-plus'
import { pinyin } from 'pinyin-pro'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

import type { VxeTableEvents, VxeTablePropTypes } from 'vxe-table'

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

const isNameColumn = (columnIndex: number) => {
  return columnIndex <= 1
}

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
</script>

<template>
  <div class="student-info h-full flex flex-col" v-if="isNotEmpty">
    <div class="flex-1 overflow-hidden">
      <vxe-table
        ref="tableRef"
        border
        show-overflow
        auto-resize
        align="center"
        height="auto"
        :edit-config="editConfig"
        :column-config="columnConfig"
        :menu-config="menuConfig"
        :data="tableData"
        @column-dragend="columnDragendHandle"
        @menu-click="menuClickEvent"
      >
        <vxe-column type="seq" title="序号" width="60" fixed="left" :resizable="false" />
        <vxe-column
          field="xing4_ming2"
          title="姓名"
          width="100"
          fixed="left"
          sortable
          resizable
          :edit-render="{ name: 'input' }"
        />
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
  </div>

  <div v-else class="h-full flex items-center justify-center">
    <el-empty description="暂无学生信息，请先上传" />
  </div>
</template>
