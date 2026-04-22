import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { match } from 'pinyin-pro'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useEnterUp } from '@/hooks/useEnterUp'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'

import { generateSingleComment } from '@/ai/aiService'
import { extractStudentTags } from '@/utils/studentUntil'

import type { StudentDataType } from '@/types/StudentData'
import { NAME_PROP } from '@/types/Constants'

interface UseEvaluationInputOptions {
  onScroll: (index: number) => void
  autoNextOnSubmit?: boolean
  promptUnsavedOnSwitch?: boolean
  onActiveStudentChange?: (student: StudentDataType | null) => void
}

interface InputFormDataType {
  id: number | null
  name: string
  comment: string | null
}

interface FocusableType {
  focus: () => void
}

export function useEvaluationInput(options: UseEvaluationInputOptions) {
  const {
    onScroll,
    autoNextOnSubmit = false,
    promptUnsavedOnSwitch = false,
    onActiveStudentChange
  } = options

  const router = useRouter()
  const dataStore = useDataSourceStore()
  const configuration = useConfigurationStore()
  const settingStore = useSettingStore()
  const aiConfigStore = useAIConfigStore()

  const { items: originList } = storeToRefs(dataStore)
  const { tagCategory: tagCategoryList } = storeToRefs(settingStore)

  const generating = ref(false)
  const optionsList = ref<StudentDataType[]>([])
  const currentSelectedIndex = ref<number | null>(null)

  const nameInputRef = ref<FocusableType | null>(null)
  const commentInputRef = ref<FocusableType | null>(null)

  const formData = reactive<InputFormDataType>({
    id: null,
    name: '',
    comment: null
  })

  const currentStudentTags = computed<Record<string, string[]> | null>(() => {
    if (!formData.id) return null
    const item = originList.value[formData.id - 1]
    if (!item || !item.tags) return {}
    return item.tags
  })

  const hasAnyTags = computed(() => {
    const tags = currentStudentTags.value
    if (!tags || Object.keys(tags).length === 0) return false
    for (const category of tagCategoryList.value) {
      const tagList = tags[category.prop]
      if (tagList && tagList.length > 0) return true
    }
    return false
  })

  const autoFocus = () => {
    nameInputRef.value?.focus()
  }

  const getStudentName = (student: StudentDataType): string => {
    const name = student[NAME_PROP]
    return name === null || name === undefined ? '' : String(name)
  }

  // AI 生成评语时仍会补充当前录入科目的成绩，便于模型拿到更多学生上下文。
  const getStudentScore = (student: StudentDataType): number | null => {
    if (!configuration.inputScoreTab) return null
    const value = student[configuration.inputScoreTab]
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return Number.isNaN(parsed) ? null : parsed
    }
    return null
  }

  const remoteMethod = (query: string) => {
    if (!query) {
      optionsList.value = []
      return
    }

    optionsList.value = originList.value.filter((item) => {
      const name = getStudentName(item)
      return name.includes(query) || !!match(name, query)?.length
    })
  }

  const fillStudentData = (index: number | null) => {
    if (!index) return
    const item = originList.value[index - 1]
    if (!item) return

    currentSelectedIndex.value = index
    optionsList.value = [item]
    formData.id = index
    formData.name = getStudentName(item)
    formData.comment = item.comment || null
    onActiveStudentChange?.(item)

    onScroll(index)

    commentInputRef.value?.focus()
  }

  const normalizeComment = (comment: string | null | undefined): string => {
    if (!comment) return ''
    return comment.trim()
  }

  const hasUnsavedChanges = () => {
    if (!formData.id) return false
    const currentItem = originList.value[formData.id - 1]
    if (!currentItem) return false

    return normalizeComment(formData.comment) !== normalizeComment(currentItem.comment || '')
  }

  const saveCurrentData = () => {
    if (!formData.id) return false

    const item = originList.value[formData.id - 1]
    if (!item) return false

    item.comment = formData.comment?.trim() ? formData.comment : undefined

    return true
  }

  const trySwitchStudent = async (nextIndex: number) => {
    if (!nextIndex || nextIndex < 1 || nextIndex > originList.value.length) return
    if (formData.id === nextIndex) {
      fillStudentData(nextIndex)
      return
    }

    if (!promptUnsavedOnSwitch || !hasUnsavedChanges()) {
      fillStudentData(nextIndex)
      return
    }

    try {
      await ElMessageBox.confirm('当前评语有未保存内容，是否保存后再切换？', '切换学生', {
        type: 'warning',
        confirmButtonText: '保存并切换',
        cancelButtonText: '放弃修改并切换',
        distinguishCancelAndClose: true,
        closeOnClickModal: false,
        closeOnPressEscape: true
      })

      const saved = saveCurrentData()
      if (saved) fillStudentData(nextIndex)
    } catch (action) {
      if (action === 'cancel') {
        fillStudentData(nextIndex)
      }
    }
  }

  const selectChange = (index: number) => {
    trySwitchStudent(index)
  }

  useEnterUp('stuName', () => {
    fillStudentData(currentSelectedIndex.value)
  })

  const resetForm = () => {
    formData.id = null
    formData.name = ''
    formData.comment = null
    optionsList.value = []
    onActiveStudentChange?.(null)
    autoFocus()
  }

  const onSubmit = () => {
    const saved = saveCurrentData()
    if (!saved || !formData.id) return

    if (autoNextOnSubmit) {
      const nextIndex = formData.id + 1

      if (nextIndex <= originList.value.length) {
        fillStudentData(nextIndex)
      } else {
        ElMessage.info('已是最后一名学生')
        fillStudentData(formData.id)
      }

      return
    }

    resetForm()
  }

  const editData = (data: StudentDataType) => {
    const name = getStudentName(data)
    remoteMethod(name)

    const rowIndex = originList.value.findIndex((item) => item === data)
    if (rowIndex === -1) return

    trySwitchStudent(rowIndex + 1)
  }

  const goToEditTags = () => {
    if (!formData.name) return
    router.push({
      path: '/setting',
      query: {
        tab: 'student-info',
        'edit-tags': '1',
        'student-name': formData.name,
        'return-to': 'comment',
        'return-student-name': formData.name
      }
    })
  }

  const handleGenerateComment = async () => {
    if (!formData.id) return

    if (!aiConfigStore.isConfigured) {
      ElMessage.warning('请先在设置页面配置 AI')
      return
    }

    const item = originList.value[formData.id - 1]
    if (!item) return

    generating.value = true
    try {
      const allTags = extractStudentTags(item, tagCategoryList.value)

      const student = {
        name: getStudentName(item),
        tags: allTags,
        score: getStudentScore(item) ?? undefined
      }

      const comment = await generateSingleComment(student, aiConfigStore.prompts.singleComment, {
        modelType: aiConfigStore.modelType,
        model: aiConfigStore.model,
        apiKey: aiConfigStore.apiKey,
        baseUrl: aiConfigStore.baseUrl
      })

      formData.comment = comment
      ElMessage.success('评语生成成功')
    } catch (error) {
      console.error('生成评语失败:', error)
      ElMessage.error('生成评语失败：' + (error as Error).message)
    } finally {
      generating.value = false
    }
  }

  onMounted(() => {
    autoFocus()
  })

  return {
    originList,
    tagCategoryList,
    generating,
    optionsList,
    formData,
    currentStudentTags,
    hasAnyTags,
    nameInputRef,
    commentInputRef,
    autoFocus,
    remoteMethod,
    selectChange,
    onSubmit,
    editData,
    goToEditTags,
    handleGenerateComment
  }
}
