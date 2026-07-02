<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'
import { pinyin } from 'pinyin-pro'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'

import { ElMessageBox, ElMessage, type InputInstance } from 'element-plus'
import type { TagCategoryType } from '@/types/Setting'
import { generateTags } from '@/ai/aiService'

const store = useSettingStore()

const { tagCategories: list, tags } = storeToRefs(store)

const InputRef = ref<InputInstance>()
const inputValue = ref('')
const inputVisible = ref(false)
const isProcessingInput = ref(false)
const activeCategory = ref(list.value[0]?.prop || '')

watch(
  () => list.value,
  (newList) => {
    if (newList.length > 0 && !newList.find((item) => item.prop === activeCategory.value)) {
      activeCategory.value = newList[0].prop
    }
  },
  { immediate: true }
)

const aiDialogVisible = ref(false)
const generating = ref(false)
const generateCount = ref(10)
const generateRequirement = ref('')
const generatedTags = ref<string[]>([])
const selectedTags = ref<string[]>([])

const aiStore = useAIConfigStore()

const currentTags = computed(() => {
  return tags.value[activeCategory.value] || []
})

const selectCategory = (item: TagCategoryType) => {
  activeCategory.value = item.prop
}

const addCategory = () => {
  ElMessageBox.prompt('', '请输入新的字典分类', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(({ value }) => {
      const newCategory = {
        prop: pinyin(value, { toneType: 'num', type: 'array' }).join('_'),
        label: value
      }
      list.value.push(newCategory)
      activeCategory.value = newCategory.prop
      inputValue.value = ''
    })
    .catch(() => {})
}

const removeCategory = (item: TagCategoryType) => {
  list.value.splice(list.value.indexOf(item), 1)
  delete tags.value[item.prop]
  activeCategory.value = ''
}

const handleClose = (tag: string) => {
  const categoryTags = tags.value[activeCategory.value]
  if (categoryTags) {
    categoryTags.splice(categoryTags.indexOf(tag), 1)
  }
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    InputRef.value!.input!.focus()
  })
}

const getAllOtherCategoryTags = () => {
  const allTags: string[] = []
  Object.entries(tags.value).forEach(([prop, tagList]) => {
    if (prop !== activeCategory.value) {
      allTags.push(...tagList)
    }
  })
  return allTags
}

const handleInputConfirm = async () => {
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

const openAIGenerateDialog = () => {
  if (!activeCategory.value) {
    ElMessage.warning('请先选择一个标签分类')
    return
  }
  aiDialogVisible.value = true
  generateCount.value = 10
  generateRequirement.value = '积极正向的学习表现标签，适合小学生使用'
  generatedTags.value = []
  selectedTags.value = []
}

const handleGenerateTags = async () => {
  if (!aiStore.apiKey.trim()) {
    ElMessage.warning('请先在AI配置中设置API Key')
    return
  }

  generating.value = true
  try {
    const category = list.value.find((item) => item.prop === activeCategory.value)?.label || ''
    const newTags = await generateTags(
      category,
      generateCount.value,
      generateRequirement.value,
      aiStore.prompts.tagGenerate,
      {
        modelType: aiStore.modelType,
        model: aiStore.model,
        apiKey: aiStore.apiKey,
        baseUrl: aiStore.baseUrl
      }
    )

    // 过滤掉已存在的标签（当前分类 + 其他分类）
    const existingTags = tags.value[activeCategory.value] || []
    const allOtherTags = getAllOtherCategoryTags()
    const uniqueTags = newTags.filter(
      (tag) => !existingTags.includes(tag) && !allOtherTags.includes(tag)
    )

    generatedTags.value = uniqueTags
    ElMessage.success(`生成成功，共 ${uniqueTags.length} 个新标签`)
  } catch (error) {
    console.error('生成标签失败:', error)
    ElMessage.error('生成标签失败，请检查AI配置')
  } finally {
    generating.value = false
  }
}

const handleAddSelectedTags = () => {
  if (selectedTags.value.length === 0) {
    ElMessage.warning('请先选择要添加的标签')
    return
  }

  const currentTags = tags.value[activeCategory.value] || []
  const newTags = selectedTags.value.filter((tag) => !currentTags.includes(tag))

  if (newTags.length === 0) {
    ElMessage.warning('所选标签均已存在')
    return
  }

  if (!tags.value[activeCategory.value]) {
    tags.value[activeCategory.value] = []
  }

  tags.value[activeCategory.value].push(...newTags)
  aiDialogVisible.value = false
  ElMessage.success(`成功添加 ${newTags.length} 个标签`)
}
</script>

<template>
  <div class="label-maintenance__wrapper">
    <div class="label-maintenance-aside">
      <div class="label-maintenance-aside-header">
        <div class="label-maintenance-aside-title">字典分类</div>
        <el-tooltip effect="dark" content="新增分类" placement="top">
          <el-button type="primary" circle size="small" @click="addCategory">
            <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
          </el-button>
        </el-tooltip>
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
</template>

<style scoped lang="scss">
.label-maintenance__wrapper {
  display: flex;
  height: 100%;
  width: 100%;
  background: #ffffff;

  .label-maintenance-aside {
    height: 100%;
    width: 200px;
    border-right: 1px solid #e2e8f0;
    background: #fcfcfc;
    border-radius: 0 0 0 8px;
    padding: 12px;

    .label-maintenance-aside-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .label-maintenance-aside-title {
      height: 32px;
      font-size: 18px;
      font-weight: 700;
      line-height: 32px;
      color: rgba(0, 0, 0, 0.85);
    }

    .label-maintenance-aside-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      height: 40px;
      cursor: pointer;
      border-bottom: 1px solid rgba(226, 232, 240, 0.85);
      font-size: 16px;
      font-weight: 400;
      color: rgba(0, 0, 0, 0.85);
      padding: 0 8px;

      .item-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-icon {
        margin-left: 8px;
        outline: none;
      }

      &:hover {
        background-color: #f5f5f5;
        color: var(--el-color-primary);
      }
    }

    .label-maintenance-aside-item.active {
      background-color: #ecf5ff;
      color: var(--el-color-primary);
    }

    .label-maintenance-aside-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 3px;
      height: 100%;
      background-color: var(--el-color-primary);
    }
  }

  .label-maintenance-main {
    flex: 1;
    padding: 16px;

    .label-maintenance-main-title {
      height: 32px;
      font-size: 18px;
      font-weight: 700;
      line-height: 32px;
      color: rgba(0, 0, 0, 0.85);
      margin-bottom: 16px;
    }

    .label-maintenance-main-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .label-maintenance-main-empty {
      color: #909399;
      font-size: 14px;
    }
  }
}

.generate-form {
  .select-all-wrapper {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .tags-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag-checkbox {
    margin: 0;
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
  }
}
</style>
