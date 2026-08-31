<script setup lang="ts">
/**
 * 学生信息管理组件：以可编辑表格维护学生名单、成绩列与标签。
 * 支持弹窗新增/编辑、删除、动态成绩列增删、单个/批量标签编辑，以及从评语页回跳后恢复编辑。
 */
import { computed, h, nextTick, ref, shallowRef } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { ElMessage, ElMessageBox } from 'element-plus'
import { pinyin } from 'pinyin-pro'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { createStudentId } from '@/utils/studentUtil'
import {
  buildStudentInfoTagSummaryMap,
  getStudentInfoTagSummary,
  insertStudentAtSequence,
  moveStudentToSequence
} from '@/views/student-info/utils/studentInfoTableUtil'
import TagEditorDialog from './TagEditorDialog.vue'
import BatchTagDrawer from './BatchTagDrawer.vue'
import StudentFormDialog from '@/views/student-info/components/StudentFormDialog.vue'

import type { VxeTableEvents, VxeTablePropTypes } from 'vxe-table'
import { NAME_PROP } from '@/constants'
import type { StudentDataType } from '@/types/StudentData'

/** 学生数据在表格中的可编辑扩展类型 */
type EditableStudentType = StudentDataType

/** 表格列的最小结构，用于判断固定列与字段名 */
interface TableColumnType {
  fixed?: boolean | string
  field?: string
}

/** 组件入参：支持从评语页跳转回来后定位目标学生 */
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

const tableRef = shallowRef<{ clearSort: () => void | Promise<unknown> } | null>(null)
const rowConfig = { keyField: 'studentId' } // 行配置：以 studentId 作为行唯一键
const cellConfig = { height: 48 } // 单元格统一高度
const virtualYConfig = { enabled: true, gt: 40, oSize: 5 } // 虚拟滚动：超过 40 行启用

/**
 * 按 studentId 删除指定学生行。
 * @param row - 待删除的学生行
 */
const deleteStudent = (row: EditableStudentType) => {
  const index = tableData.value.findIndex((student) => student.studentId === row.studentId)
  if (index > -1) {
    tableData.value.splice(index, 1)
  }
}

const studentFormVisible = ref(false)
const editingStudent = ref<EditableStudentType | null>(null)
/** 弹窗中的当前序号：新增默认末尾，编辑使用 Store 数组中的实际位置。 */
const studentFormSequence = computed(() => {
  if (!editingStudent.value) return tableData.value.length + 1
  const index = tableData.value.findIndex(
    (student) => student.studentId === editingStudent.value?.studentId
  )
  return index === -1 ? 1 : index + 1
})
/** 弹窗允许的最大序号。 */
const studentFormMaxSequence = computed(() =>
  editingStudent.value ? Math.max(1, tableData.value.length) : tableData.value.length + 1
)

/** 打开新增学生弹窗。 */
const openCreateStudent = () => {
  editingStudent.value = null
  studentFormVisible.value = true
}

/** 打开指定学生的编辑弹窗。 */
const openEditStudent = (row: EditableStudentType) => {
  editingStudent.value = row
  studentFormVisible.value = true
}

/** 保存新增或编辑结果，并按目标序号重排 Store 中的学生数组。 */
const saveStudent = async (
  values: Record<string, string | number | boolean | null | undefined>,
  sequence: number
) => {
  if (editingStudent.value) {
    Object.assign(editingStudent.value, values)
    moveStudentToSequence(tableData.value, editingStudent.value.studentId, sequence)
    ElMessage.success('学生信息已更新')
  } else {
    insertStudentAtSequence(
      tableData.value,
      { studentId: createStudentId(), ...values } as StudentDataType,
      sequence
    )
    ElMessage.success('学生添加成功')
  }
  studentFormVisible.value = false
  editingStudent.value = null
  await nextTick()
  await tableRef.value?.clearSort()
}

/** 前往系统学生的批量评语处理工作区。 */
const openBatchComments = () => {
  router.push('/tools/comments')
}

/** 前往系统设置中的 Excel 数据导入区域。 */
const openBatchImport = () => {
  router.push({ path: '/setting', query: { tab: 'system-backup', section: 'excel-import' } })
}

/** 预构建“学生 -> 标签摘要”映射，供表格渲染复用，避免每行重复计算 */
const rowTagSummaryMap = computed(() =>
  buildStudentInfoTagSummaryMap(tableData.value, categories.value)
)

/**
 * 获取某学生行的标签摘要。
 * @param row - 学生行
 */
const getRowTagSummary = (row: EditableStudentType) =>
  getStudentInfoTagSummary(rowTagSummaryMap.value, row.studentId)

const dialogVisible = ref(false) // 单个标签编辑弹窗显隐
const batchDrawerVisible = ref(false) // 批量标签抽屉显隐
const currentEditRow = ref<EditableStudentType | null>(null) // 当前编辑标签的学生行
const batchStudentList = ref<EditableStudentType[]>([]) // 批量编辑用的临时学生列表

/**
 * 打开单个学生的标签编辑弹窗。
 * @param row - 目标学生行
 */
const openTagEditor = (row: EditableStudentType) => {
  currentEditRow.value = row
  dialogVisible.value = true
}

/** 关闭标签编辑弹窗并清空当前编辑行 */
const closeTagEditor = () => {
  dialogVisible.value = false
  currentEditRow.value = null
}

/**
 * 确认单个标签编辑：写入新标签并关闭弹窗，
 * 若从评语页跳转而来则携带恢复标记返回。
 * @param tags - 编辑后的标签结构
 */
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

/**
 * 打开批量标签编辑抽屉，深拷贝每个学生的标签，避免直接污染原数据。
 */
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

/** 关闭批量标签编辑抽屉并清空临时列表 */
const closeBatchEditor = () => {
  batchDrawerVisible.value = false
  batchStudentList.value = []
}

/**
 * 将批量编辑结果写回原学生数据（仅更新标签）。
 * @param updatedStudents - 编辑后的学生列表
 */
const saveBatchEdit = (updatedStudents: EditableStudentType[]) => {
  updatedStudents.forEach((student) => {
    const originalStudent = tableData.value.find((item) => item.studentId === student.studentId)
    if (originalStudent) {
      originalStudent.tags = student.tags
    }
  })
}

/**
 * 确认批量编辑：保存结果并关闭抽屉。
 * @param updatedStudents - 编辑后的学生列表
 */
const confirmBatchEdit = (updatedStudents: EditableStudentType[]) => {
  saveBatchEdit(updatedStudents)
  closeBatchEditor()
}

/**
 * 跳转到设置页指定标签页。
 * @param tab - 目标标签页名称
 */
const goToTab = (tab: string) => {
  router.push({ path: '/setting', query: { tab } })
}

/** 表头右键菜单配置：固定列不展示列操作菜单 */
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

/** 是否存在学生数据，用于切换空态与表格视图 */
const isNotEmpty = computed(() => store.students?.length)

/**
 * 判断列是否为固定列。
 * @param column - 表格列
 * @returns 是否为固定列
 */
const isFixedColumn = (column: TableColumnType) => {
  // 通过 column.fixed 属性判断是否是固定列
  return !!column.fixed
}

/**
 * 以中文列名生成拼音 prop，创建新表头配置。
 * @param label - 列名
 * @returns 新表头配置项
 */
const createHeader = (label: string) => ({
  prop: pinyin(label, { toneType: 'num', type: 'array' }).join('_'),
  label,
  disabled: false
})

/**
 * 根据表格列字段定位表头配置下标。
 * @param column - 表格列
 * @returns 表头下标，未找到返回 -1
 */
const findHeaderIndexByColumn = (column: TableColumnType): number => {
  if (!column.field) return -1
  return headers.value.findIndex((item) => item.prop === column.field)
}

/**
 * 表头右键菜单点击处理：在目标列左/右新增列或删除列。
 */
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
        // 同步删除所有学生数据中该列对应的字段
        tableData.value.forEach((e) => {
          if (column.field) {
            delete e[column.field]
          }
        })
      })
      break
  }
}

/**
 * 按 studentId 打开标签编辑弹窗，供父组件通过 ref 调用。
 * @param studentId - 学生 ID
 * @returns 是否成功定位并打开
 */
const openTagEditorById = (studentId: string) => {
  const student = tableData.value.find((item) => item.studentId === studentId)
  if (!student) return false

  openTagEditor(student)
  return true
}

// 虚拟删除弹窗状态：仅在表格外渲染一次，通过 virtual-ref 定位到具体行
const deletePopoverVisible = ref(false)
const pendingDeleteRow = ref<EditableStudentType | null>(null)
const deleteTriggerRef = ref<HTMLElement>()

/**
 * 打开删除确认弹窗，记录待删除行与触发元素。
 * @param row - 待删除学生行
 * @param event - 触发点击事件
 */
const openDeletePopover = (row: EditableStudentType, event: MouseEvent) => {
  pendingDeleteRow.value = row
  deleteTriggerRef.value = event.currentTarget as HTMLElement
  deletePopoverVisible.value = true
}

/** 确认删除当前待删除行并关闭弹窗 */
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

    <div class="student-info__toolbar">
      <div>
        <strong>学生名单</strong>
        <span>共 {{ tableData.length }} 名学生</span>
      </div>
      <div class="student-info__toolbar-actions">
        <el-button size="small" @click="openBatchComments">
          <font-awesome-icon :icon="['solid', 'comments']" />
          批量评语
        </el-button>
        <el-button size="small" @click="openBatchImport">
          <font-awesome-icon :icon="['solid', 'file-import']" />
          Excel 导入
        </el-button>
        <el-button type="primary" size="small" @click="openCreateStudent">
          <font-awesome-icon :icon="['solid', 'user-plus']" />
          新增学生
        </el-button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <!-- 学生信息可编辑表格：序号/姓名/标签/禁用/操作固定，成绩列动态渲染 -->
      <vxe-table
        ref="tableRef"
        border
        align="center"
        height="100%"
        :menu-config="menuConfig"
        :row-config="rowConfig"
        :cell-config="cellConfig"
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
            <div class="operation-icons">
              <span class="operation-icon" title="编辑" @click="openEditStudent(row)">
                <font-awesome-icon :icon="['fas', 'pen']" />
              </span>
              <span
                class="operation-icon delete-icon"
                title="删除"
                @click.stop="openDeletePopover(row, $event)"
              >
                <font-awesome-icon :icon="['fas', 'trash']" />
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
        />
      </vxe-table>
    </div>

    <!-- 单个与批量标签编辑组件 -->
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

    <StudentFormDialog
      v-model="studentFormVisible"
      :student="editingStudent"
      :score-columns="enabledHeaders"
      :sequence="studentFormSequence"
      :max-sequence="studentFormMaxSequence"
      @save="saveStudent"
    />
  </div>

  <!-- 无学生数据时支持直接新增或进入 Excel 批量导入 -->
  <div v-else class="student-info__empty h-full flex items-center justify-center">
    <el-empty description="暂无学生信息，可单个新增或通过 Excel 批量导入">
      <div class="student-info__empty-actions">
        <el-button @click="openBatchImport">批量导入学生</el-button>
        <el-button type="primary" @click="openCreateStudent">新增学生</el-button>
      </div>
    </el-empty>
    <StudentFormDialog
      v-model="studentFormVisible"
      :student="editingStudent"
      :score-columns="enabledHeaders"
      :sequence="studentFormSequence"
      :max-sequence="studentFormMaxSequence"
      @save="saveStudent"
    />
  </div>
</template>

<style scoped lang="scss">
.student-info__toolbar {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid #ebeef5;
}

.student-info__toolbar > div,
.student-info__toolbar-actions,
.student-info__empty-actions,
.operation-icons {
  display: flex;
  align-items: center;
}

.student-info__toolbar > div:first-child {
  gap: 8px;
}

.student-info__toolbar strong {
  color: #303133;
  font-size: 15px;
}

.student-info__toolbar span {
  color: #909399;
  font-size: 12px;
}

.student-info__toolbar-actions,
.student-info__empty-actions,
.operation-icons {
  gap: 8px;
}

.operation-icons {
  width: 100%;
  justify-content: center;
}

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
