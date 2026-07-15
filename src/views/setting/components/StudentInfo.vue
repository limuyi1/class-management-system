<script setup lang="ts">
import { computed, ref, h } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { ElMessage, ElMessageBox } from 'element-plus'
import { pinyin } from 'pinyin-pro'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { createStudentId } from '@/utils/studentUntil'
import {
  buildStudentInfoTagSummaryMap,
  getStudentInfoTagSummary
} from '@/views/student-info/utils/studentInfoTableUntil'
import TagEditorDialog from './TagEditorDialog.vue'
import BatchTagDrawer from './BatchTagDrawer.vue'

import type { VxeTableEvents, VxeTablePropTypes } from 'vxe-table'
import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

type EditableStudentType = StudentDataType & {
  isNew?: boolean
}

interface TableColumnType {
  fixed?: boolean | string
  field?: string
}

interface Props {
  returnTo?: string
  returnStudentId?: string
}

const props = withDefaults(defineProps<Props>(), {
  returnTo: '',
  returnStudentId: ''
})

const router = useRouter()

const store = useDataSourceStore()
const settingStore = useSettingStore()
const { students: tableData } = storeToRefs(store)
const { scoreColumns: headers, enabledScoreColumns: enabledHeaders } = storeToRefs(settingStore)
const { tagCategories: categories } = storeToRefs(settingStore)

const tableRef = ref()
const rowConfig = { keyField: 'studentId', height: 48 }
const virtualYConfig = { enabled: true, gt: 40, oSize: 5 }

const getStudentName = (student: EditableStudentType): string => {
  return String(student[NAME_PROP] || '')
}

const deleteStudent = (row: EditableStudentType) => {
  const index = tableData.value.findIndex((student) => student.studentId === row.studentId)
  if (index > -1) {
    tableData.value.splice(index, 1)
  }
}

const addStudentAbove = (row: EditableStudentType) => {
  const index = tableData.value.findIndex((student) => student.studentId === row.studentId)
  if (index === -1) return
  const newStudent: EditableStudentType = {
    studentId: createStudentId(),
    [NAME_PROP]: '',
    isNew: true
  }
  tableData.value.splice(index, 0, newStudent)
}

const addStudentBelow = (row: EditableStudentType) => {
  const index = tableData.value.findIndex((student) => student.studentId === row.studentId)
  if (index === -1) return
  const newStudent: EditableStudentType = {
    studentId: createStudentId(),
    [NAME_PROP]: '',
    isNew: true
  }
  tableData.value.splice(index + 1, 0, newStudent)
}

const confirmNewStudent = (row: EditableStudentType) => {
  const name = getStudentName(row).trim()
  if (!name) {
    ElMessage.error('姓名不能为空')
    return
  }
  row[NAME_PROP] = name
  delete row.isNew
}

const cancelNewStudent = (row: EditableStudentType) => {
  const index = tableData.value.findIndex((student) => student.studentId === row.studentId)
  if (index > -1) {
    tableData.value.splice(index, 1)
  }
}

const rowTagSummaryMap = computed(() =>
  buildStudentInfoTagSummaryMap(tableData.value, categories.value)
)

const getRowTagSummary = (row: EditableStudentType) =>
  getStudentInfoTagSummary(rowTagSummaryMap.value, row.studentId)

const dialogVisible = ref(false)
const batchDrawerVisible = ref(false)
const currentEditRow = ref<EditableStudentType | null>(null)
const batchStudentList = ref<EditableStudentType[]>([])

const openTagEditor = (row: EditableStudentType) => {
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

  if (props.returnTo === 'comment' && props.returnStudentId) {
    router.push({
      path: '/tools/comments',
      query: {
        'resume-edit': '1',
        'student-id': props.returnStudentId
      }
    })
  }
}

const openBatchEditor = () => {
  batchStudentList.value = tableData.value.map((student) => ({
    ...student,
    tags: student.tags
      ? Object.fromEntries(
          Object.entries(student.tags).map(([category, tags]) => [category, [...tags]])
        )
      : undefined
  }))
  batchDrawerVisible.value = true
}

const closeBatchEditor = () => {
  batchDrawerVisible.value = false
  batchStudentList.value = []
}

const saveBatchEdit = (updatedStudents: EditableStudentType[]) => {
  updatedStudents.forEach((student) => {
    const originalStudent = tableData.value.find((item) => item.studentId === student.studentId)
    if (originalStudent) {
      originalStudent.tags = student.tags
    }
  })
}

const confirmBatchEdit = (updatedStudents: EditableStudentType[]) => {
  saveBatchEdit(updatedStudents)
  closeBatchEditor()
}

const goToTab = (tab: string) => {
  router.push({ path: '/setting', query: { tab } })
}

const editConfig = ref<VxeTablePropTypes.EditConfig>({
  trigger: 'dblclick',
  mode: 'cell',
  showIcon: false
})
const menuConfig = ref<VxeTablePropTypes.MenuConfig>({
  header: {
    options: [
      [
        {
          prefixIcon: () => h(FontAwesomeIcon, { icon: ['solid', 'plus'] }),
          code: 'addLeft',
          name: '向左添加列'
        },
        {
          prefixIcon: () => h(FontAwesomeIcon, { icon: ['solid', 'plus'] }),
          code: 'addRight',
          name: '向右添加列'
        },
        {
          prefixIcon: () => h(FontAwesomeIcon, { icon: ['solid', 'trash-can'] }),
          code: 'remove',
          name: '删除列'
        }
      ]
    ]
  },
  visibleMethod: ({ column }) => !isFixedColumn(column as TableColumnType)
})

const isNotEmpty = computed(() => store.students?.length)

const isFixedColumn = (column: TableColumnType) => {
  // 通过 column.fixed 属性判断是否是固定列
  return !!column.fixed
}

const createHeader = (label: string) => ({
  prop: pinyin(label, { toneType: 'num', type: 'array' }).join('_'),
  label,
  disabled: false
})

const findHeaderIndexByColumn = (column: TableColumnType): number => {
  if (!column.field) return -1
  return headers.value.findIndex((item) => item.prop === column.field)
}

const menuClickEvent: VxeTableEvents.MenuClick = ({ menu, column }) => {
  const headerIndex = findHeaderIndexByColumn(column as TableColumnType)
  if (headerIndex === -1) {
    return
  }

  switch (menu.code) {
    case 'addRight':
      ElMessageBox.prompt('请输入列名', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入列名'
      }).then(({ value }) => {
        if (value) {
          headers.value?.splice(headerIndex + 1, 0, createHeader(value))
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
          headers.value?.splice(headerIndex, 0, createHeader(value))
        }
      })
      break
    case 'remove':
      ElMessageBox.confirm('确定要删除该列吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        headers.value?.splice(headerIndex, 1)
        tableData.value.forEach((e) => {
          if (column.field) {
            delete e[column.field]
          }
        })
      })
      break
  }
}

const openTagEditorById = (studentId: string) => {
  const student = tableData.value.find((item) => item.studentId === studentId)
  if (!student) return false

  openTagEditor(student)
  return true
}

// 虚拟删除弹窗状态
const deletePopoverVisible = ref(false)
const pendingDeleteRow = ref<EditableStudentType | null>(null)
const deleteTriggerRef = ref<HTMLElement>()

const openDeletePopover = (row: EditableStudentType, event: MouseEvent) => {
  pendingDeleteRow.value = row
  deleteTriggerRef.value = event.currentTarget as HTMLElement
  deletePopoverVisible.value = true
}

const confirmDelete = () => {
  if (pendingDeleteRow.value) {
    deleteStudent(pendingDeleteRow.value)
    pendingDeleteRow.value = null
  }
  deletePopoverVisible.value = false
}

defineExpose({
  openTagEditorById
})
</script>

<template>
  <div class="student-info h-full flex flex-col" v-if="isNotEmpty">
    <!-- 虚拟删除弹窗（表格外唯一实例） -->
    <el-popover
      placement="top"
      :width="160"
      trigger="click"
      v-model:visible="deletePopoverVisible"
      :virtual-ref="deleteTriggerRef"
      virtual-triggering
    >
      <div class="text-center">
        <p>确定删除 {{ pendingDeleteRow?.[NAME_PROP] }}？</p>
        <div class="mt-2">
          <el-button type="danger" size="small" @click="confirmDelete">确定</el-button>
          <el-button size="small" @click="deletePopoverVisible = false">取消</el-button>
        </div>
      </div>
    </el-popover>

    <div class="flex-1 overflow-hidden">
      <vxe-table
        ref="tableRef"
        border
        align="center"
        height="100%"
        :edit-config="editConfig"
        :menu-config="menuConfig"
        :row-config="rowConfig"
        :virtual-y-config="virtualYConfig"
        :data="tableData"
        @menu-click="menuClickEvent"
      >
        <vxe-column type="seq" title="序号" width="60" fixed="left" :resizable="false" />
        <vxe-column
          :field="NAME_PROP"
          title="姓名"
          width="100"
          fixed="left"
          sortable
          resizable
          :edit-render="{ name: 'input' }"
        />
        <vxe-column field="tags" title="标签" min-width="300" fixed="left" resizable>
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
              <div class="tags-cell-inner" v-if="getRowTagSummary(row).visibleTags.length > 0">
                <el-tag
                  v-for="tag in getRowTagSummary(row).visibleTags"
                  :key="tag.key"
                  size="small"
                  :color="tag.color"
                  effect="dark"
                  class="tags-cell__tag"
                  disable-transitions
                >
                  {{ tag.label }}
                </el-tag>
                <span v-if="getRowTagSummary(row).hiddenCount" class="tags-cell__more">
                  +{{ getRowTagSummary(row).hiddenCount }}
                </span>
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
        <vxe-column field="cao_zuo" title="操作" width="100" fixed="right" :resizable="false">
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
              <span
                class="operation-icon delete-icon"
                title="删除"
                @click.stop="openDeletePopover(row, $event)"
              >
                <font-awesome-icon :icon="['fas', 'trash']" />
              </span>
              <span class="operation-icon" title="上方添加一行" @click="addStudentAbove(row)">
                <font-awesome-icon :icon="['fas', 'chevron-up']" />
              </span>
              <span class="operation-icon" title="下方添加一行" @click="addStudentBelow(row)">
                <font-awesome-icon :icon="['fas', 'chevron-down']" />
              </span>
            </div>
          </template>
        </vxe-column>
        <vxe-column
          v-for="item in enabledHeaders"
          :key="item.prop"
          :field="item.prop"
          :title="item.label"
          sortable
          resizable
          min-width="180"
          :edit-render="{ name: 'input' }"
        />
      </vxe-table>
    </div>

    <TagEditorDialog
      v-model:visible="dialogVisible"
      :student="currentEditRow"
      @confirm="confirmTagEdit"
      @go-tab="goToTab"
    />

    <BatchTagDrawer
      v-model:visible="batchDrawerVisible"
      :student-list="batchStudentList"
      @save="saveBatchEdit"
      @confirm="confirmBatchEdit"
      @go-tab="goToTab"
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
  flex-wrap: nowrap;
  justify-content: flex-start;
  align-items: center;
  padding: 2px 4px;
  gap: 4px;
  cursor: pointer;
  min-height: 28px;
}

.tags-cell-inner {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.tags-cell__tag {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tags-cell__more {
  flex-shrink: 0;
  color: #909399;
  font-size: 12px;
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

.operation-icon {
  cursor: pointer;
}
</style>
