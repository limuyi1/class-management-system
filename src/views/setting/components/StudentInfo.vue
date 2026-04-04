<script setup lang="tsx">
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { ElMessage, ElMessageBox, ElPopover, ElTooltip } from 'element-plus'
import { pinyin } from 'pinyin-pro'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import TagEditorDialog from './TagEditorDialog.vue'
import BatchTagDrawer from './BatchTagDrawer.vue'

import type { VxeTableEvents, VxeTablePropTypes } from 'vxe-table'

const router = useRouter()

const store = useDataSourceStore()
const settingStore = useSettingStore()
const { data: tableData } = storeToRefs(store)
const { tableHeaders: headers } = storeToRefs(settingStore)
const { tagCategory: categories } = storeToRefs(settingStore)

const tableRef = ref()

const deleteStudent = (row: any) => {
  const index = tableData.value.indexOf(row)
  if (index > -1) {
    tableData.value.splice(index, 1)
  }
}

const addStudentAbove = (row: any) => {
  const index = tableData.value.indexOf(row)
  const newStudent = { xing4_ming2: '', isNew: true }
  tableData.value.splice(index, 0, newStudent)
}

const addStudentBelow = (row: any) => {
  const index = tableData.value.indexOf(row)
  const newStudent = { xing4_ming2: '', isNew: true }
  tableData.value.splice(index + 1, 0, newStudent)
}

const confirmNewStudent = (row: any) => {
  if (!row.xing4_ming2 || !row.xing4_ming2.trim()) {
    ElMessage.error('姓名不能为空')
    return
  }
  delete row.isNew
}

const cancelNewStudent = (row: any) => {
  const index = tableData.value.indexOf(row)
  if (index > -1) {
    tableData.value.splice(index, 1)
  }
}

const tagColorVars = [
  'var(--theme-tag-1)',
  'var(--theme-tag-2)',
  'var(--theme-tag-3)',
  'var(--theme-tag-4)',
  'var(--theme-tag-5)',
  'var(--theme-tag-6)',
  'var(--theme-tag-7)',
  'var(--theme-tag-8)'
]

const getTagColor = (category: string) => {
  const catIndex = categories.value.findIndex((c) => c.label === category)
  return tagColorVars[catIndex % tagColorVars.length]
}

const getRowTags = (row: any): { label: string; category: string }[] => {
  if (!row.tags) return []
  const result: { label: string; category: string }[] = []
  for (const [cat, tagList] of Object.entries(row.tags)) {
    if (Array.isArray(tagList)) {
      tagList.forEach((tag: string) => {
        const catInfo = categories.value.find((c) => c.prop === cat)
        result.push({ label: tag, category: catInfo?.label || cat })
      })
    }
  }
  return result
}

const dialogVisible = ref(false)
const batchDrawerVisible = ref(false)
const currentEditRow = ref<any>(null)
const batchStudentList = ref<any[]>([])

const openTagEditor = (row: any) => {
  currentEditRow.value = row
  dialogVisible.value = true
}

const closeTagEditor = () => {
  dialogVisible.value = false
  currentEditRow.value = null
}

const confirmTagEdit = (tags: Record<string, string[]>) => {
  if (!currentEditRow.value) return
  currentEditRow.value.tags = tags
  closeTagEditor()
}

const openBatchEditor = () => {
  batchStudentList.value = [...tableData.value]
  batchDrawerVisible.value = true
}

const closeBatchEditor = () => {
  batchDrawerVisible.value = false
  batchStudentList.value = []
}

const confirmBatchEdit = (updatedStudents: any[]) => {
  updatedStudents.forEach((student) => {
    const originalStudent = tableData.value.find((s) => s.xing4_ming2 === student.xing4_ming2)
    if (originalStudent) {
      originalStudent.tags = student.tags
    }
  })
  closeBatchEditor()
}

const goToLabelMaintenance = () => {
  closeBatchEditor()
  router.push({ path: '/setting', query: { tab: 'label-maintenance' } })
}

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
    const filteredColumns = tableColumn.filter((col: any) => col.field !== 'tags')
    headers.value = filteredColumns.splice(2).map((e: any) => ({
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

const openTagEditorByName = (name: string) => {
  const student = tableData.value.find((item) => item.xing4_ming2 === name)
  if (student) {
    openTagEditor(student)
  }
}

defineExpose({
  openTagEditorByName
})
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
        <vxe-column field="tags" title="标签" min-width="180" fixed="left" resizable>
          <template #header>
            <div class="tags-header">
              <span>标签</span>
              <el-button type="primary" link @click.stop="openBatchEditor">
                <template #icon><font-awesome-icon :icon="['solid', 'layer-group']" /></template>
              </el-button>
            </div>
          </template>
          <template #default="{ row }">
            <div class="tags-cell" @click="openTagEditor(row)">
              <div class="tags-cell-inner" v-if="getRowTags(row).length > 0">
                <el-tag
                  v-for="(tag, index) in getRowTags(row)"
                  :key="index"
                  size="small"
                  :color="getTagColor(tag.category)"
                  effect="dark"
                  class="mr-1 mb-1"
                >
                  {{ tag.label }}
                </el-tag>
              </div>
              <span v-else class="tags-placeholder">
                <font-awesome-icon :icon="['solid', 'plus']" />
                <span class="ml-1">添加标签</span>
              </span>
            </div>
          </template>
        </vxe-column>
        <vxe-column field="disabled" title="禁用" width="70" fixed="right" :resizable="false">
          <template #default="{ row }">
            <el-switch v-model="row.disabled" size="small" />
          </template>
        </vxe-column>
        <vxe-column title="操作" width="100" fixed="right" :resizable="false">
          <template #default="{ row }">
            <div class="operation-icons" v-if="row.isNew">
              <span class="operation-icon" @click="confirmNewStudent(row)" title="确认">
                <font-awesome-icon :icon="['fas', 'check']" />
              </span>
              <span class="operation-icon" @click="cancelNewStudent(row)" title="取消">
                <font-awesome-icon :icon="['fas', 'times']" />
              </span>
            </div>
            <div class="operation-icons" v-else>
              <el-popover
                placement="top"
                :width="160"
                trigger="click"
                v-model:visible="row.popoverVisible"
              >
                <template #reference>
                  <span class="operation-icon delete-icon" title="删除">
                    <font-awesome-icon :icon="['fas', 'trash']" />
                  </span>
                </template>
                <div class="text-center">
                  <p>确定删除该学生？</p>
                  <div class="mt-2">
                    <el-button
                      type="danger"
                      size="small"
                      @click="
                        () => {
                          deleteStudent(row)
                          row.popoverVisible = false
                        }
                      "
                      >确定</el-button
                    >
                    <el-button size="small" @click="row.popoverVisible = false">取消</el-button>
                  </div>
                </div>
              </el-popover>
              <el-tooltip effect="dark" content="上方添加一行" placement="top">
                <span class="operation-icon" @click="addStudentAbove(row)">
                  <font-awesome-icon :icon="['fas', 'chevron-up']" />
                </span>
              </el-tooltip>
              <el-tooltip effect="dark" content="下方添加一行" placement="top">
                <span class="operation-icon" @click="addStudentBelow(row)">
                  <font-awesome-icon :icon="['fas', 'chevron-down']" />
                </span>
              </el-tooltip>
            </div>
          </template>
        </vxe-column>
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

    <TagEditorDialog
      v-model:visible="dialogVisible"
      :student="currentEditRow"
      @confirm="confirmTagEdit"
    />

    <BatchTagDrawer
      v-model:visible="batchDrawerVisible"
      :student-list="batchStudentList"
      @confirm="confirmBatchEdit"
    />
  </div>

  <div v-else class="h-full flex items-center justify-center">
    <el-empty description="暂无学生信息，请先上传" />
  </div>
</template>

<style scoped lang="scss">
.tags-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tags-cell {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  padding: 2px 4px;
  gap: 4px;
  cursor: pointer;
  min-height: 28px;
}

.tags-cell-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tags-placeholder {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  color: #909399;
  cursor: pointer;
  font-size: 12px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }
}
</style>
