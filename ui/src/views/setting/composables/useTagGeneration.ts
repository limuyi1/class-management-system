import { ref } from 'vue'

import { ElMessage } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { generateTagCategories, generateTags } from '@/ai/aiService'
import { createUniqueTagCategories } from '@/utils/tagCategoryUtil'

import type { Ref } from 'vue'

/** 管理 AI 标签和分类的生成、筛选与应用，复用当前分类引用。 */
export function useTagGeneration(activeCategory: Ref<string>) {
  const store = useSettingStore()
  const { tagCategories: list, tags } = storeToRefs(store)

  // AI 生成标签弹窗相关状态
  const aiDialogVisible = ref(false)

  const generating = ref(false)

  const generateCount = ref(10)

  const generateRequirement = ref('')

  const generatedTags = ref<string[]>([])

  const selectedTags = ref<string[]>([])

  // AI 生成字典分类弹窗相关状态
  const categoryAIDialogVisible = ref(false)

  const categoryGenerating = ref(false)

  const categoryGenerateCount = ref(6)

  const categoryGenerateRequirement = ref('')

  const generatedCategories = ref<string[]>([])

  const selectedCategories = ref<string[]>([])

  const aiStore = useAIConfigStore()

  /** 收集除当前分类外其他所有分类下的标签，用于跨分类重复判断 */
  const getAllOtherCategoryTags = () => {
    const allTags: string[] = []
    Object.entries(tags.value).forEach(([prop, tagList]) => {
      if (prop !== activeCategory.value) {
        allTags.push(...tagList)
      }
    })
    return allTags
  }

  /** 打开 AI 生成标签弹窗，重置生成参数与结果 */
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

  /** 打开 AI 生成字典分类弹窗，重置生成参数与结果 */
  const openAIGenerateCategoryDialog = () => {
    categoryAIDialogVisible.value = true
    categoryGenerateCount.value = 6
    categoryGenerateRequirement.value =
      '适合小学班主任维护学生表现标签，覆盖学习、行为、情绪和交往等维度'
    generatedCategories.value = []
    selectedCategories.value = []
  }

  /** 调用 AI 生成分类，过滤空白项与已存在分类后展示 */
  const handleGenerateCategories = async () => {
    if (!aiStore.apiKey.trim()) {
      ElMessage.warning('请先在AI配置中设置API Key')
      return
    }

    categoryGenerating.value = true
    try {
      const newCategories = await generateTagCategories(
        categoryGenerateCount.value,
        categoryGenerateRequirement.value,
        aiStore.prompts.tagCategoryGenerate,
        {
          modelType: aiStore.modelType,
          model: aiStore.model,
          apiKey: aiStore.apiKey,
          baseUrl: aiStore.baseUrl
        }
      )

      const existingLabels = new Set(list.value.map((item) => item.label))
      // 去空白、去重，并排除已存在的分类名
      const uniqueCategories = Array.from(
        new Set(newCategories.map((item) => item.trim()).filter(Boolean))
      ).filter((item) => !existingLabels.has(item))

      generatedCategories.value = uniqueCategories
      ElMessage.success(`生成成功，共 ${uniqueCategories.length} 个新分类`)
    } catch (error) {
      console.error('生成分类失败:', error)
      ElMessage.error('生成分类失败，请检查AI配置')
    } finally {
      categoryGenerating.value = false
    }
  }

  /** 调用 AI 为当前分类生成标签，过滤已存在标签后展示 */
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

  /** 将选中的生成标签加入当前分类，过滤已存在项 */
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

  /** 将选中的生成分类加入列表，并切换到首个新分类 */
  const handleAddSelectedCategories = () => {
    if (selectedCategories.value.length === 0) {
      ElMessage.warning('请先选择要添加的分类')
      return
    }

    const newCategories = createUniqueTagCategories(selectedCategories.value, list.value)

    if (newCategories.length === 0) {
      ElMessage.warning('所选分类均已存在')
      return
    }

    newCategories.forEach((category) => {
      list.value.push(category)
      tags.value[category.prop] = []
    })

    activeCategory.value = newCategories[0].prop
    categoryAIDialogVisible.value = false
    ElMessage.success(`成功添加 ${newCategories.length} 个分类`)
  }
  return {
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
  }
}
