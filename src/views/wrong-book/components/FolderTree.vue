<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ElTree, ElButton, ElInput, ElMessageBox, ElMessage } from 'element-plus'
import { useWrongBookStore } from '@/stores/wrong-book'
import type { TreeNode } from '@/types/FolderTree'

const wrongBookStore = useWrongBookStore()
const { folders, selectedFolderId, questions } = storeToRefs(wrongBookStore)

/** Element Tree 的字段映射配置 */
const defaultProps = {
  children: 'children',
  label: 'name'
}

/** 由扁平文件夹列表构建的树形结构，按 order 排序 */
const treeData = computed<TreeNode[]>(() => {
  // 先建立 id 到树节点的映射，再据此把节点挂载到对应父节点下
  const map = new Map<string, TreeNode>()
  folders.value.forEach((f) => {
    map.set(f.id, { ...f, children: [] })
  })
  const result: TreeNode[] = []
  folders.value.forEach((f) => {
    const node = map.get(f.id)
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children!.push(node!)
    } else {
      result.push(node!)
    }
  })
  return result.sort((a, b) => a.order - b.order)
})

/** 默认展开的节点键，初始展开默认文件夹 */
const expandedKeys = ref<string[]>(['default'])

/**
 * 统计指定文件夹下的题目数量
 * @param folderId - 文件夹 id
 * @returns 题目数量
 */
const getQuestionCount = (folderId: string) => {
  return questions.value.filter((q) => q.folderId === folderId).length
}

/**
 * 统计指定文件夹下收藏题目的数量
 * @param folderId - 文件夹 id
 * @returns 收藏题目数量
 */
const getFavoritesCount = (folderId: string) => {
  return questions.value.filter((q) => q.folderId === folderId && q.isFavorite).length
}

/**
 * 点击节点时切换到该文件夹
 * @param data - 被点击的树节点
 */
const handleNodeClick = (data: TreeNode) => {
  wrongBookStore.selectFolder(data.id)
}

const editingFolderId = ref<string | null>(null)
const editingName = ref('')

/** 新建文件夹（默认名称为“新建文件夹”） */
const handleAddFolder = () => {
  wrongBookStore.addFolder('新建文件夹')
}

/**
 * 进入文件夹重命名状态
 * @param data - 待重命名的树节点
 */
const handleRename = (data: TreeNode) => {
  editingFolderId.value = data.id
  editingName.value = data.name
}

/**
 * 确认重命名，空名称时给出警告
 * @param data - 待重命名的树节点
 */
const handleRenameConfirm = (data: TreeNode) => {
  if (!editingName.value.trim()) {
    ElMessage.warning('文件夹名称不能为空')
    return
  }
  wrongBookStore.updateFolder(data.id, { name: editingName.value.trim() })
  editingFolderId.value = null
}

/**
 * 删除文件夹（默认/收藏文件夹禁止删除），删除前二次确认
 * @param data - 待删除的树节点
 */
const handleDelete = async (data: TreeNode) => {
  if (data.id === 'default' || data.id === 'favorites') {
    ElMessage.warning('默认文件夹或收藏文件夹不能删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除文件夹 "${data.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    wrongBookStore.deleteFolder(data.id)
    ElMessage.success('删除成功')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="folder-tree-container">
    <div class="folder-header">
      <span class="folder-title">文件夹</span>
      <el-button size="small" text @click="handleAddFolder">
        <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
      </el-button>
    </div>
    <el-scrollbar>
      <el-tree
        :data="treeData"
        :props="defaultProps"
        :default-expanded-keys="expandedKeys"
        node-key="id"
        :expand-on-click-node="false"
        @node-click="handleNodeClick"
      >
        <template #default="{ data }">
          <div
            class="custom-tree-node"
            :class="{
              active: selectedFolderId === data.id,
              'is-favorites': data.id === 'favorites'
            }"
          >
            <div class="node-content">
              <font-awesome-icon
                v-if="data.id === 'favorites'"
                :icon="['solid', selectedFolderId === data.id ? 'star' : 'star']"
                class="folder-icon favorites-icon"
              />
              <font-awesome-icon
                v-else
                :icon="['solid', selectedFolderId === data.id ? 'folder-open' : 'folder']"
                class="folder-icon"
              />
              <span v-if="editingFolderId !== data.id" class="folder-label">{{ data.name }}</span>
              <el-input
                v-else
                v-model="editingName"
                size="small"
                class="folder-input"
                @keyup.enter="handleRenameConfirm(data)"
                @blur="handleRenameConfirm(data)"
              />
              <span v-if="data.id === 'favorites'" class="question-count favorites-count">{{
                getFavoritesCount(data.id)
              }}</span>
              <span v-else class="question-count">{{ getQuestionCount(data.id) }}</span>
            </div>
            <div class="node-actions" @click.stop>
              <el-button v-if="data.id === 'favorites'" size="small" text type="warning">
                <template #icon><font-awesome-icon :icon="['solid', 'star']" /></template>
              </el-button>
              <template v-else>
                <el-button size="small" text @click="handleRename(data)">
                  <template #icon><font-awesome-icon :icon="['solid', 'pen']" /></template>
                </el-button>
                <el-button
                  v-if="data.id !== 'default'"
                  size="small"
                  text
                  type="danger"
                  @click="handleDelete(data)"
                >
                  <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
                </el-button>
              </template>
            </div>
          </div>
        </template>
      </el-tree>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.folder-tree-container {
  height: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
  margin-bottom: 12px;

  .folder-title {
    font-weight: 600;
    color: #333;
  }
}

:deep(.el-tree) {
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: 36px;
}

.custom-tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
  flex: 1;

  &:hover {
    background-color: #f5f7fa;

    .node-actions {
      opacity: 1;
    }
  }

  &.active {
    background-color: var(--theme-menu-active-bg);
    color: var(--theme-menu-active);
  }
}

.node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.folder-icon {
  color: #e6a23c;

  &.favorites-icon {
    color: #e6a23c;
  }
}

.custom-tree-node.is-favorites {
  .folder-label {
    color: #e6a23c;
    font-weight: 500;
  }
}

.favorites-count {
  background: #fdf6ec;
  color: #e6a23c;
}

.folder-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-input {
  width: 80px;
}

.question-count {
  font-size: 12px;
  color: #909399;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 10px;
}

.node-actions {
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  gap: 4px;
}
</style>
