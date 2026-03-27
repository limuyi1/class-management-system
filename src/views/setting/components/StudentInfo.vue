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
const { tagCategory: categories, tags: tagOptions } = storeToRefs(settingStore)

const tableRef = ref()

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

const tagColors = [
  '#67c23a',
  '#409eff',
  '#e6a23c',
  '#f56c6c',
  '#909399',
  '#c71585',
  '#37a168',
  '#2b7cde'
]

const getTagColor = (category: string) => {
  const catIndex = categories.value.findIndex((c) => c.label === category)
  return tagColors[catIndex % tagColors.length]
}

const dialogVisible = ref(false)
const batchDrawerVisible = ref(false)
const currentEditRow = ref<any>(null)
const currentCascaderValue = ref<string[][]>([])

const openTagEditor = (row: any) => {
  currentEditRow.value = row
  currentCascaderValue.value = getRowTagsValue(row)
  dialogVisible.value = true
}

const closeTagEditor = () => {
  dialogVisible.value = false
  currentEditRow.value = null
  currentCascaderValue.value = []
}

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

const batchSelectedTags = ref<Set<string>>(new Set())

const openBatchEditor = () => {
  const allTags = new Set<string>()
  for (const cat of categories.value) {
    const tags = tagOptions.value[cat.prop] || []
    tags.forEach((t) => allTags.add(t))
  }
  batchSelectedTags.value = new Set(allTags)
  batchDrawerVisible.value = true
}

const closeBatchEditor = () => {
  batchDrawerVisible.value = false
  batchSelectedTags.value = new Set()
}

const toggleBatchTag = (tag: string) => {
  if (batchSelectedTags.value.has(tag)) {
    batchSelectedTags.value.delete(tag)
  } else {
    batchSelectedTags.value.add(tag)
  }
}

const selectAllBatchTags = () => {
  batchSelectedTags.value.clear()
  for (const cat of categories.value) {
    const tags = tagOptions.value[cat.prop] || []
    tags.forEach((t) => batchSelectedTags.value.add(t))
  }
}

const clearAllBatchTags = () => {
  batchSelectedTags.value.clear()
}

const applyToAll = () => {
  const tagsToApply: Record<string, string[]> = {}
  batchSelectedTags.value.forEach((tag) => {
    for (const cat of categories.value) {
      const catTags = tagOptions.value[cat.prop] || []
      if (catTags.includes(tag)) {
        if (!tagsToApply[cat.prop]) tagsToApply[cat.prop] = []
        tagsToApply[cat.prop].push(tag)
        break
      }
    }
  })
  tableData.value.forEach((row) => {
    row.tags = { ...tagsToApply }
  })
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
        <vxe-column field="tags" title="标签" width="220" fixed="left">
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
      title="批量编辑标签"
      direction="rtl"
      size="400px"
      :show-close="false"
      destroy-on-close
    >
      <div class="batch-drawer-content">
        <div class="batch-actions">
          <el-button size="small" @click="selectAllBatchTags">全选</el-button>
          <el-button size="small" @click="clearAllBatchTags">清空</el-button>
        </div>

        <div class="batch-tags-list">
          <div v-for="cat in categories" :key="cat.prop" class="batch-category">
            <div class="category-title">{{ cat.label }}</div>
            <div class="category-tags">
              <el-tag
                v-for="tag in tagOptions[cat.prop] || []"
                :key="tag"
                :type="batchSelectedTags.has(tag) ? 'primary' : 'info'"
                :effect="batchSelectedTags.has(tag) ? 'dark' : 'plain'"
                class="batch-tag"
                @click="toggleBatchTag(tag)"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="batch-summary">已选择 {{ batchSelectedTags.size }} 个标签</div>
      </div>

      <template #footer>
        <el-button @click="closeBatchEditor">取消</el-button>
        <el-button type="primary" @click="applyToAll">应用到全部</el-button>
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
  justify-content: center;
  padding: 2px 0;
  cursor: pointer;
}

.tags-cell-inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
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

.batch-drawer-content {
  .batch-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .batch-tags-list {
    .batch-category {
      margin-bottom: 16px;

      .category-title {
        font-size: 14px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 8px;
      }

      .category-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .batch-tag {
          cursor: pointer;
        }
      }
    }
  }

  .batch-summary {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e4e7ed;
    font-size: 14px;
    color: #606266;
  }
}
</style>
