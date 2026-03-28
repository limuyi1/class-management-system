<script setup lang="tsx">
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { ElMessage, ElMessageBox, ElPopover, ElTooltip } from 'element-plus'
import { pinyin } from 'pinyin-pro'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

const router = useRouter()

import type { VxeTableEvents, VxeTablePropTypes } from 'vxe-table'

const store = useDataSourceStore()
const settingStore = useSettingStore()
const { data: tableData } = storeToRefs(store)
const { tableHeaders: headers } = storeToRefs(settingStore)
const { tagCategory: categories, tags: tagOptions } = storeToRefs(settingStore)

const toggleDisabled = (row: any) => {
  row.disabled = !row.disabled
}

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

const tableRef = ref()

/**
 * 计算级联选择器选项
 * 将标签分类和标签转换为级联选择器可用的格式
 * 用于标签编辑对话框中的级联选择器
 */
const cascaderOptions = computed(() => {
  return categories.value.map((cat) => ({
    value: cat.prop,
    label: cat.label,
    children: (tagOptions.value[cat.prop] || []).map((tag) => ({
      value: tag,
      label: tag
    }))
  }))
})

/**
 * 从学生行数据中提取标签信息（用于显示）
 * 将行数据的 tags 对象转换为 { label: string, category: string } 数组
 * @param row - 学生行数据对象
 * @returns 标签信息数组，包含标签名和所属分类
 */
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

/**
 * 从学生行数据中提取标签值（用于级联选择器编辑）
 * 将行数据的 tags 对象转换为级联选择器需要的二维数组格式
 * @param row - 学生行数据对象
 * @returns 二维数组，格式为 [[分类prop, 标签名], ...]
 */
const getRowTagsValue = (row: any): string[][] => {
  if (!row.tags) return []
  const result: string[][] = []
  for (const [cat, tagList] of Object.entries(row.tags)) {
    if (Array.isArray(tagList)) {
      tagList.forEach((tag: string) => result.push([cat, tag]))
    }
  }
  return result
}

/**
 * 标签颜色变量列表
 * 对应 CSS 变量中的主题色，用于不同分类的标签显示
 */
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

/**
 * 根据分类名称获取对应的标签颜色
 * 通过分类在分类列表中的索引映射到颜色变量
 * @param category - 分类显示名称
 * @returns 对应的 CSS 变量颜色值
 */
const getTagColor = (category: string) => {
  const catIndex = categories.value.findIndex((c) => c.label === category)
  return tagColorVars[catIndex % tagColorVars.length]
}

const dialogVisible = ref(false)
const batchDrawerVisible = ref(false)
const currentEditRow = ref<any>(null)
const currentCascaderValue = ref<string[][]>([])

/**
 * 打开单行标签编辑对话框
 * @param row - 当前编辑的学生行数据
 */
const openTagEditor = (row: any) => {
  currentEditRow.value = row
  currentCascaderValue.value = getRowTagsValue(row)
  dialogVisible.value = true
}

/**
 * 关闭标签编辑对话框
 * 重置对话框状态
 */
const closeTagEditor = () => {
  dialogVisible.value = false
  currentEditRow.value = null
  currentCascaderValue.value = []
}

/**
 * 确认标签修改并保存
 * 将级联选择器的选择结果转换为 tags 格式并保存到行数据
 */
const confirmTagEdit = () => {
  if (!currentEditRow.value) return
  const tags: Record<string, string[]> = {}
  currentCascaderValue.value.forEach(([cat, tag]) => {
    if (!tags[cat]) tags[cat] = []
    tags[cat].push(tag)
  })
  currentEditRow.value.tags = tags
  closeTagEditor()
}

const studentList = ref<any[]>([])
const currentIndex = ref(0)
const currentStudentTags = ref<Set<string>>(new Set())

/**
 * 已标记标签的学生数量
 * 用于批量编辑时显示进度
 */
const taggedStudentCount = computed(() => {
  return studentList.value.filter((student) => {
    if (!student.tags) return false
    for (const [, tagList] of Object.entries(student.tags)) {
      if (Array.isArray(tagList) && tagList.length > 0) return true
    }
    return false
  }).length
})

/**
 * 标签总数
 * 所有分类下的标签数量之和
 */
const totalTagCount = computed(() => {
  let count = 0
  for (const cat of categories.value) {
    const tags = tagOptions.value[cat.prop] || []
    count += tags.length
  }
  return count
})

/**
 * 获取当前正在编辑的学生
 */
const getCurrentStudent = () => studentList.value[currentIndex.value]

/**
 * 加载当前学生的已有标签
 * 将学生数据的 tags 解析为 Set 格式，用于批量编辑界面的标签选择状态
 */
const loadCurrentStudentTags = () => {
  const student = getCurrentStudent()
  if (!student) return
  const tagSet = new Set<string>()
  if (student.tags) {
    for (const [, tagList] of Object.entries(student.tags)) {
      if (Array.isArray(tagList)) {
        tagList.forEach((tag: string) => tagSet.add(tag))
      }
    }
  }
  currentStudentTags.value = tagSet
}

/**
 * 切换标签的选中状态
 * @param tag - 标签名称
 */
const toggleTag = (tag: string) => {
  if (currentStudentTags.value.has(tag)) {
    currentStudentTags.value.delete(tag)
  } else {
    currentStudentTags.value.add(tag)
  }
}

/**
 * 检查标签是否被选中
 * @param tag - 标签名称
 * @returns 是否选中
 */
const isTagSelected = (tag: string) => currentStudentTags.value.has(tag)

/**
 * 保存当前学生的标签到数据中
 * 将当前选中的标签反向查找对应的分类，并保存到学生数据
 * @returns 是否发生了实际修改
 */
const saveCurrentTags = () => {
  const student = getCurrentStudent()
  if (!student) return false

  const tags: Record<string, string[]> = {}
  currentStudentTags.value.forEach((tag) => {
    for (const cat of categories.value) {
      const catTags = tagOptions.value[cat.prop] || []
      if (catTags.includes(tag)) {
        if (!tags[cat.prop]) tags[cat.prop] = []
        tags[cat.prop].push(tag)
        break
      }
    }
  })

  const prevTags = JSON.stringify(student.tags || {})
  const newTags = JSON.stringify(tags)

  if (prevTags !== newTags) {
    student.tags = tags
    return true
  }
  return false
}

/**
 * 打开批量打标签抽屉
 * 初始化学生列表和当前索引，准备进行批量标签编辑
 */
const openBatchEditor = () => {
  studentList.value = [...tableData.value]
  currentIndex.value = 0
  loadCurrentStudentTags()
  batchDrawerVisible.value = true
}

/**
 * 关闭批量打标签抽屉
 * 清理相关状态数据
 */
const closeBatchEditor = () => {
  batchDrawerVisible.value = false
  studentList.value = []
  currentIndex.value = 0
  currentStudentTags.value = new Set()
}

/**
 * 跳转到标签维护页面
 * 关闭当前抽屉后导航到标签维护设置
 */
const goToLabelMaintenance = () => {
  closeBatchEditor()
  router.push({ path: '/setting', query: { tab: 'label-maintenance' } })
}

/**
 * 批量编辑中跳转到上一个学生
 * 循环回到最后一个学生
 */
const goToPrevStudent = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    loadCurrentStudentTags()
  } else {
    currentIndex.value = studentList.value.length - 1
    loadCurrentStudentTags()
  }
}

/**
 * 批量编辑中跳转到下一个学生
 * 保存当前学生标签后移动到下一个，编辑完成后关闭抽屉
 */
const goToNextStudent = () => {
  saveCurrentTags()

  if (currentIndex.value < studentList.value.length - 1) {
    currentIndex.value++
    loadCurrentStudentTags()
  } else {
    closeBatchEditor()
  }
}

/**
 * 确认并关闭批量编辑
 * 先保存当前学生的标签，然后关闭抽屉
 */
const confirmAndClose = () => {
  saveCurrentTags()
  closeBatchEditor()
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

/**
 * 按学生姓名打开标签编辑对话框
 * 从学生数据中查找对应姓名的学生并打开单行编辑dialog
 * @param name - 学生姓名
 */
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
                <font-awesome-icon :icon="['solid', 'layer-group']" />
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

    <el-dialog
      v-model="dialogVisible"
      :title="`为 ${currentEditRow?.xing4_ming2 || ''} 添加标签`"
      width="400px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-cascader
        v-model="currentCascaderValue"
        :options="cascaderOptions"
        :props="{ multiple: true }"
        placeholder="选择标签"
        clearable
        class="w-full"
      />
      <template #footer>
        <el-button @click="closeTagEditor">取消</el-button>
        <el-button type="primary" @click="confirmTagEdit">确定</el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="batchDrawerVisible"
      title="快捷打标签"
      direction="rtl"
      size="420px"
      :show-close="false"
      destroy-on-close
    >
      <div class="quick-tag-drawer">
        <div class="drawer-header">
          <el-button
            type="primary"
            link
            :disabled="studentList.length <= 1"
            @click="goToPrevStudent"
          >
            <font-awesome-icon :icon="['fas', 'chevron-left']" />
            <span class="ml-1">上一个</span>
          </el-button>
          <span class="progress-text">{{ currentIndex + 1 }} / {{ studentList.length }}</span>
          <el-button
            type="primary"
            link
            :disabled="studentList.length <= 1"
            @click="goToNextStudent"
          >
            <span>下一个</span>
            <font-awesome-icon :icon="['fas', 'chevron-right']" class="ml-1" />
          </el-button>
        </div>

        <div class="current-student">
          <span class="student-label">当前学生：</span>
          <span class="student-name">{{ getCurrentStudent()?.xing4_ming2 || '' }}</span>
        </div>

        <div class="tags-section">
          <div v-if="totalTagCount === 0" class="empty-tags-tip" @click="goToLabelMaintenance">
            <font-awesome-icon :icon="['fas', 'tag']" />
            <span>暂无标签，点击添加</span>
          </div>
          <div v-else v-for="cat in categories" :key="cat.prop" class="tag-category">
            <div class="category-name">{{ cat.label }}</div>
            <div class="category-tags">
              <el-tag
                v-for="tag in tagOptions[cat.prop] || []"
                :key="tag"
                :effect="isTagSelected(tag) ? 'dark' : 'plain'"
                :color="isTagSelected(tag) ? getTagColor(cat.label) : undefined"
                class="tag-item"
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="progress-info">
          <span>已标记：{{ taggedStudentCount }} 人</span>
          <el-progress
            :percentage="Math.round((taggedStudentCount / studentList.length) * 100)"
            :stroke-width="6"
            :show-text="false"
            class="progress-bar"
          />
        </div>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="closeBatchEditor">取消</el-button>
          <el-button type="primary" @click="confirmAndClose">保存并关闭</el-button>
        </div>
      </template>
    </el-drawer>
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

.quick-tag-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid #e4e7ed;
    margin-bottom: 16px;

    .progress-text {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .current-student {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding: 12px 16px;
    background-color: #f5f7fa;
    border-radius: 8px;

    .student-label {
      color: #909399;
      font-size: 14px;
    }

    .student-name {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .tags-section {
    flex: 1;
    overflow-y: auto;

    .empty-tags-tip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 40px 20px;
      color: #909399;
      font-size: 14px;
      background-color: #f5f7fa;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: var(--el-color-primary);
        background-color: #ecf5ff;
      }
    }

    .tag-category {
      margin-bottom: 20px;

      .category-name {
        font-size: 14px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 10px;
        padding-left: 8px;
        border-left: 3px solid var(--el-color-primary);
      }

      .category-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 4px 0;

        .tag-item {
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            transform: scale(1.05);
          }
        }
      }
    }
  }

  .progress-info {
    padding-top: 16px;
    border-top: 1px solid #e4e7ed;
    margin-top: auto;

    span {
      display: block;
      font-size: 14px;
      color: #606266;
      margin-bottom: 8px;
    }

    .progress-bar {
      width: 100%;
    }
  }
}

.drawer-footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.operation-icons {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.operation-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  color: #606266;

  &:hover {
    background-color: #f0f0f0;
    color: var(--el-color-primary);
  }

  &.delete-icon:hover {
    color: #f56c6c;
  }
}
</style>
