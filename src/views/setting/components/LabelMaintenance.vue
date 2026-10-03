<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { ElMessageBox, ElMessage, type InputInstance } from 'element-plus'

import { storeToRefs } from 'pinia'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import { useSettingStore } from '@/stores/setting'
import { createDefaultTagCategories, createDefaultTags } from '@/config/defaultTags'
import { createUniqueTagCategory } from '@/utils/tagCategoryUtil'
import { useTagGeneration } from '@/views/setting/composables/useTagGeneration'

import type { TagCategoryType } from '@/types/Setting'

const store = useSettingStore()

const { tagCategories: list, tags } = storeToRefs(store)

const InputRef = ref<InputInstance>()

// 标签输入框实例引用
const inputValue = ref('')

// 新标签输入值
const inputVisible = ref(false)

// 标签输入框是否可见
const isProcessingInput = ref(false)

// 输入确认处理中，防止重复触发
const activeCategory = ref(list.value[0]?.prop || '')

const {
  aiDialogVisible,
  generating,
  generateCount,
  generateRequirement,
  generatedTags,
  selectedTags,
  categoryAIDialogVisible,
  categoryGenerating,
  categoryGenerateCount,
  categoryGenerateRequirement,
  generatedCategories,
  selectedCategories,
  getAllOtherCategoryTags,
  openAIGenerateDialog,
  openAIGenerateCategoryDialog,
  handleGenerateCategories,
  handleGenerateTags,
  handleAddSelectedTags,
  handleAddSelectedCategories
} = useTagGeneration(activeCategory)

// 当前选中的分类 prop

// 列表变化后若当前选中分类已不存在，则回退到首个分类
watch(
  () => list.value,
  (newList) => {
    if (newList.length > 0 && !newList.find((item) => item.prop === activeCategory.value)) {
      activeCategory.value = newList[0].prop
    }
  },
  { immediate: true }
)

/** 当前选中分类下的标签列表 */
const currentTags = computed(() => {
  return tags.value[activeCategory.value] || []
})

/**
 * 切换当前选中的标签分类。
 * @param item - 目标分类
 */
const selectCategory = (item: TagCategoryType) => {
  activeCategory.value = item.prop
}

/** 新增字典分类：命名去重后追加并切换到新分类 */
const addCategory = () => {
  ElMessageBox.prompt('', '请输入新的字典分类', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(({ value }) => {
      const newCategory = createUniqueTagCategory(value, list.value)
      if (!newCategory) {
        ElMessage.warning('分类名称不能为空或已存在')
        return
      }
      list.value.push(newCategory)
      tags.value[newCategory.prop] = []
      activeCategory.value = newCategory.prop
      inputValue.value = ''
    })
    .catch(() => {})
}

/**
 * 删除字典分类并清空其下标签。
 * @param item - 待删除分类
 */
const removeCategory = (item: TagCategoryType) => {
  list.value.splice(list.value.indexOf(item), 1)
  delete tags.value[item.prop]
  activeCategory.value = ''
}

/** 恢复预设分类：确认后清空现有分类与标签并写入系统默认内容 */
const restoreDefaultCategories = async () => {
  try {
    await ElMessageBox.confirm(
      '将清空当前所有字典分类和标签，并恢复为系统预设内容。是否继续？',
      '重置预设分类',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
  } catch {
    return
  }

  const defaultCategories = createDefaultTagCategories()
  const nextTags = createDefaultTags()

  list.value.splice(0, list.value.length, ...defaultCategories)
  Object.keys(tags.value).forEach((prop) => {
    delete tags.value[prop]
  })
  Object.entries(nextTags).forEach(([prop, tagList]) => {
    tags.value[prop] = tagList
  })

  activeCategory.value = defaultCategories[0].prop
  ElMessage.success('已重置为预设分类')
}

/**
 * 从当前分类移除指定标签。
 * @param tag - 待移除标签名
 */
const handleClose = (tag: string) => {
  const categoryTags = tags.value[activeCategory.value]
  if (categoryTags) {
    categoryTags.splice(categoryTags.indexOf(tag), 1)
  }
}

/** 显示标签输入框并自动聚焦 */
const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    InputRef.value!.input!.focus()
  })
}

/**
 * 确认输入新标签：处理空值、本分类重复与跨分类重复（询问后移动）。
 */
const handleInputConfirm = async () => {
  // 防止回车与失焦同时触发造成重复处理
  if (isProcessingInput.value) return
  isProcessingInput.value = true

  try {
    const tag = inputValue.value.trim()
    if (!tag) {
      inputVisible.value = false
      inputValue.value = ''
      return
    }

    const currentTags = tags.value[activeCategory.value] || []

    if (currentTags.includes(tag)) {
      ElMessage.warning('该标签已存在')
      inputVisible.value = false
      inputValue.value = ''
      return
    }

    const otherTags = getAllOtherCategoryTags()
    if (otherTags.includes(tag)) {
      try {
        await ElMessageBox.confirm(`该标签已在其他分类中存在，是否移动到当前分类？`, '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        // 用户确认后，从其他分类中移除同名标签
        Object.entries(tags.value).forEach(([prop, tagList]) => {
          if (prop !== activeCategory.value) {
            const idx = tagList.indexOf(tag)
            if (idx > -1) tagList.splice(idx, 1)
          }
        })
      } catch {
        inputVisible.value = false
        inputValue.value = ''
        return
      }
    }

    if (!tags.value[activeCategory.value]) {
      tags.value[activeCategory.value] = []
    }
    tags.value[activeCategory.value].push(tag)

    inputVisible.value = false
    inputValue.value = ''
  } finally {
    isProcessingInput.value = false
  }
}
</script>

<template>
  <div class="label-maintenance__wrapper">
    <!-- 左侧：字典分类列表，可重置预设、AI 生成与新增 -->
    <div class="label-maintenance-aside">
      <div class="label-maintenance-aside-header">
        <div class="label-maintenance-aside-title">字典分类</div>
        <div class="label-maintenance-aside-actions">
          <el-tooltip effect="dark" content="重置预设分类" placement="top">
            <el-button circle size="small" @click="restoreDefaultCategories">
              <template #icon><font-awesome-icon :icon="['solid', 'rotate-left']" /></template>
            </el-button>
          </el-tooltip>
          <el-tooltip effect="dark" content="AI生成分类" placement="top">
            <el-button type="primary" circle size="small" @click="openAIGenerateCategoryDialog">
              <template #icon><font-awesome-icon :icon="['solid', 'robot']" /></template>
            </el-button>
          </el-tooltip>
          <el-tooltip effect="dark" content="新增分类" placement="top">
            <el-button type="primary" circle size="small" @click="addCategory">
              <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
            </el-button>
          </el-tooltip>
        </div>
      </div>
      <div
        :class="{
          'label-maintenance-aside-item': true,
          active: activeCategory === item.prop
        }"
        v-for="item in list"
        :key="item.prop"
        @click="selectCategory(item)"
      >
        <span class="item-label">{{ item.label }}</span>
        <el-popconfirm title="确认要删除吗？" placement="top" @confirm="removeCategory(item)">
          <template #reference>
            <div><font-awesome-icon class="item-icon" :icon="['solid', 'trash']" /></div>
          </template>
        </el-popconfirm>
      </div>
    </div>
    <!-- 右侧：当前分类下的标签管理与 AI 生成 -->
    <div class="label-maintenance-main">
      <div class="label-maintenance-main-title">
        {{ list.find((item) => item.prop === activeCategory)?.label || '标签' }}
        <el-tooltip effect="dark" content="AI生成标签" placement="top">
          <el-button
            type="primary"
            size="small"
            class="ml-2"
            :disabled="!activeCategory"
            @click="openAIGenerateDialog"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'robot']" /></template>
            AI生成
          </el-button>
        </el-tooltip>
      </div>
      <div class="label-maintenance-main-tags" v-if="activeCategory">
        <el-tag
          v-for="tag in currentTags"
          :key="tag"
          effect="light"
          size="large"
          closable
          @close="handleClose(tag)"
        >
          {{ tag }}
        </el-tag>
        <el-input
          class="w-[150px]!"
          v-if="inputVisible"
          ref="InputRef"
          v-model="inputValue"
          @keyup.enter="handleInputConfirm"
          @blur="handleInputConfirm"
        />
        <el-button v-else dashed @click="showInput">
          <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
          <span>添加标签</span>
        </el-button>
      </div>
      <div class="label-maintenance-main-empty" v-else>请先添加字典分类</div>
    </div>
  </div>

  <!-- AI 生成标签弹窗：设置数量与要求后生成并选择添加 -->
  <el-dialog
    v-model="aiDialogVisible"
    title="AI生成标签"
    width="600px"
    :close-on-click-modal="false"
  >
    <el-form label-position="top" class="generate-form">
      <el-form-item label="生成数量">
        <el-input-number v-model="generateCount" :min="1" :max="50" style="width: 100%" />
      </el-form-item>
      <el-form-item label="自定义生成要求（可选）">
        <el-input
          v-model="generateRequirement"
          type="textarea"
          :rows="3"
          placeholder="例如：积极正向的学习表现标签，适合小学生使用"
        />
      </el-form-item>
      <el-form-item v-if="generatedTags.length > 0" label="选择要添加的标签">
        <div class="select-all-wrapper">
          <el-button size="small" type="primary" link @click="selectedTags = [...generatedTags]">
            <template #icon><font-awesome-icon :icon="['solid', 'check-double']" /></template>
            全选
          </el-button>
          <el-button size="small" type="info" link @click="selectedTags = []"> 取消全选 </el-button>
        </div>
        <el-checkbox-group v-model="selectedTags">
          <div class="tags-grid">
            <el-checkbox
              v-for="tag in generatedTags"
              :key="tag"
              :label="tag"
              :value="tag"
              class="tag-checkbox"
            >
              {{ tag }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="aiDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="generating" @click="handleGenerateTags">
        生成标签
      </el-button>
      <el-button
        type="success"
        @click="handleAddSelectedTags"
        :disabled="generatedTags.length === 0"
      >
        添加选中标签
      </el-button>
    </template>
  </el-dialog>

  <!-- AI 生成字典分类弹窗：设置数量与要求后生成并选择添加 -->
  <el-dialog
    v-model="categoryAIDialogVisible"
    title="AI生成字典分类"
    width="600px"
    :close-on-click-modal="false"
  >
    <el-form label-position="top" class="generate-form">
      <el-form-item label="生成数量">
        <el-input-number v-model="categoryGenerateCount" :min="1" :max="20" style="width: 100%" />
      </el-form-item>
      <el-form-item label="自定义生成要求（可选）">
        <el-input
          v-model="categoryGenerateRequirement"
          type="textarea"
          :rows="3"
          placeholder="例如：适合小学班主任维护学生表现标签，覆盖学习、行为、情绪和交往等维度"
        />
      </el-form-item>
      <el-form-item v-if="generatedCategories.length > 0" label="选择要添加的分类">
        <div class="select-all-wrapper">
          <el-button
            size="small"
            type="primary"
            link
            @click="selectedCategories = [...generatedCategories]"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'check-double']" /></template>
            全选
          </el-button>
          <el-button size="small" type="info" link @click="selectedCategories = []">
            取消全选
          </el-button>
        </div>
        <el-checkbox-group v-model="selectedCategories">
          <div class="tags-grid">
            <el-checkbox
              v-for="category in generatedCategories"
              :key="category"
              :label="category"
              :value="category"
              class="tag-checkbox"
            >
              {{ category }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="categoryAIDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="categoryGenerating" @click="handleGenerateCategories">
        生成分类
      </el-button>
      <el-button
        type="success"
        @click="handleAddSelectedCategories"
        :disabled="generatedCategories.length === 0"
      >
        添加选中分类
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss" src="./styles/label-maintenance.scss"></style>
