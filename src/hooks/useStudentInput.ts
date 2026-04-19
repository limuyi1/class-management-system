import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { match } from 'pinyin-pro'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useEnterUp } from '@/hooks/useEnterUp'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'

import { generateSingleComment } from '@/ai/aiService'
import { extractStudentTags } from '@/utils/studentUntil'

import type { StudentDataType } from '@/types/StudentData'
import { InputEnum } from '@/types/Common'
import { NAME_PROP } from '@/types/Constants'

interface UseStudentInputOptions {
  type: InputEnum
  onScroll: (index: number) => void
}

interface InputFormDataType {
  id: number | null
  name: string
  score: number | null
  comment: string | null
}

interface FocusableType {
  focus: () => void
}

export function useStudentInput(options: UseStudentInputOptions) {
  const { type, onScroll } = options

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
  const scoreInputRef = ref<FocusableType | null>(null)
  const commentInputRef = ref<FocusableType | null>(null)

  const formData = reactive<InputFormDataType>({
    id: null,
    name: '',
    score: null,
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

  const getStudentScore = (student: StudentDataType): number | null => {
    if (!configuration.inputScoreTab) return null
    const value = student[configuration.inputScoreTab]
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? null : parsed
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

    formData.id = index
    formData.name = getStudentName(item)
    formData.score = getStudentScore(item)
    formData.comment = item.comment || null

    onScroll(index)

    if (type === InputEnum.COMMENT) {
      commentInputRef.value?.focus()
    } else {
      scoreInputRef.value?.focus()
    }
  }

  const selectChange = (index: number) => {
    currentSelectedIndex.value = index
    fillStudentData(index)
  }

  useEnterUp('stuName', () => {
    fillStudentData(currentSelectedIndex.value)
  })

  const resetForm = () => {
    formData.id = null
    formData.name = ''
    formData.score = null
    formData.comment = null
    optionsList.value = []
    autoFocus()
  }

  const onSubmit = () => {
    if (!formData.id) return

    const item = originList.value[formData.id - 1]
    if (!item) return

    if (type === InputEnum.SCORE && configuration.inputScoreTab) {
      item[configuration.inputScoreTab] = formData.score
    }

    if (type === InputEnum.COMMENT) {
      item.comment = formData.comment?.trim() ? formData.comment : undefined
    }

    resetForm()
  }

  const editData = (data: StudentDataType) => {
    const name = getStudentName(data)
    remoteMethod(name)

    const rowIndex = originList.value.findIndex((item) => item === data)
    if (rowIndex === -1) return

    formData.id = rowIndex + 1
    formData.name = name
    formData.score = getStudentScore(data)
    formData.comment = data.comment || null

    if (type === InputEnum.COMMENT) {
      commentInputRef.value?.focus()
    } else {
      scoreInputRef.value?.focus()
    }
  }

  const goToEditTags = () => {
    if (!formData.name) return
    router.push({
      path: '/setting',
      query: {
        tab: 'student-info',
        'edit-tags': '1',
        'student-name': formData.name
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
    scoreInputRef,
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
