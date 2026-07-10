import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { match } from 'pinyin-pro'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useEnterUp } from '@/hooks/useEnterUp'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'

import { generateSingleComment, polishSingleComment } from '@/ai/aiService'
import { extractStudentTags } from '@/utils/studentUntil'

import type { StudentDataType } from '@/types/StudentData'
import { NAME_PROP } from '@/types/Constants'

interface UseEvaluationInputOptions {
  onScroll: (studentId: string) => void
  autoNextOnSubmit?: boolean
  promptUnsavedOnSwitch?: boolean
  onActiveStudentChange?: (student: StudentDataType | null) => void
}

interface InputFormDataType {
  studentId: string | null
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
  const settingStore = useSettingStore()
  const aiConfigStore = useAIConfigStore()

  const { students: originList } = storeToRefs(dataStore)
  const { tagCategories: tagCategoryList } = storeToRefs(settingStore)

  const generating = ref(false)
  const polishing = ref(false)
  const optionsList = ref<StudentDataType[]>([])
  const currentSelectedStudentId = ref<string | null>(null)

  const nameInputRef = ref<FocusableType | null>(null)
  const commentInputRef = ref<FocusableType | null>(null)

  const formData = reactive<InputFormDataType>({
    studentId: null,
    name: '',
    comment: null
  })

  const currentStudentTags = computed<Record<string, string[]> | null>(() => {
    if (!formData.studentId) return null
    const item = dataStore.getStudentById(formData.studentId)
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

  const fillStudentData = (studentId: string | null) => {
    if (!studentId) return
    const item = dataStore.getStudentById(studentId)
    if (!item) return

    currentSelectedStudentId.value = studentId
    optionsList.value = [item]
    formData.studentId = studentId
    formData.name = getStudentName(item)
    formData.comment = item.comment || null
    onActiveStudentChange?.(item)

    onScroll(studentId)

    commentInputRef.value?.focus()
  }

  const normalizeComment = (comment: string | null | undefined): string => {
    if (!comment) return ''
    return comment.trim()
  }

  const hasUnsavedChanges = () => {
    if (!formData.studentId) return false
    const currentItem = dataStore.getStudentById(formData.studentId)
    if (!currentItem) return false

    return normalizeComment(formData.comment) !== normalizeComment(currentItem.comment || '')
  }

  const saveCurrentData = () => {
    if (!formData.studentId) return false

    const item = dataStore.getStudentById(formData.studentId)
    if (!item) return false

    item.comment = formData.comment?.trim() ? formData.comment : undefined

    return true
  }

  const trySwitchStudent = async (nextStudentId: string) => {
    if (!dataStore.getStudentById(nextStudentId)) return
    if (formData.studentId === nextStudentId) {
      fillStudentData(nextStudentId)
      return
    }

    if (!promptUnsavedOnSwitch || !hasUnsavedChanges()) {
      fillStudentData(nextStudentId)
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
      if (saved) fillStudentData(nextStudentId)
    } catch (action) {
      if (action === 'cancel') {
        fillStudentData(nextStudentId)
      }
    }
  }

  const selectChange = (studentId: string) => {
    trySwitchStudent(studentId)
  }

  useEnterUp('stuName', () => {
    fillStudentData(currentSelectedStudentId.value)
  })

  const resetForm = () => {
    formData.studentId = null
    formData.name = ''
    formData.comment = null
    optionsList.value = []
    onActiveStudentChange?.(null)
    autoFocus()
  }

  const onSubmit = () => {
    const saved = saveCurrentData()
    if (!saved || !formData.studentId) return

    if (autoNextOnSubmit) {
      const currentIndex = originList.value.findIndex(
        (student) => student.studentId === formData.studentId
      )
      const nextStudent = originList.value[currentIndex + 1]

      if (nextStudent) {
        fillStudentData(nextStudent.studentId)
      } else {
        ElMessage.info('已是最后一名学生')
        fillStudentData(formData.studentId)
      }

      return
    }

    resetForm()
  }

  const editData = (data: StudentDataType) => {
    const name = getStudentName(data)
    remoteMethod(name)

    trySwitchStudent(data.studentId)
  }

  const goToEditTags = () => {
    if (!formData.studentId) return
    router.push({
      path: '/student-info',
      query: {
        'edit-tags': '1',
        'student-id': formData.studentId,
        'return-to': 'comment',
        'return-student-id': formData.studentId
      }
    })
  }

  const handleGenerateComment = async () => {
    if (!formData.studentId) return

    if (!aiConfigStore.isConfigured) {
      ElMessage.warning('请先在设置页面配置 AI')
      return
    }

    const item = dataStore.getStudentById(formData.studentId)
    if (!item) return

    generating.value = true
    try {
      const allTags = extractStudentTags(item, tagCategoryList.value)

      const student = {
        name: getStudentName(item),
        tags: allTags
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

  const handlePolishComment = async () => {
    if (!formData.studentId) return

    if (!aiConfigStore.isConfigured) {
      ElMessage.warning('请先在设置页面配置 AI')
      return
    }

    const currentComment = formData.comment?.trim()
    if (!currentComment) {
      ElMessage.warning('请先填写或导入评语后再润色')
      return
    }

    const item = dataStore.getStudentById(formData.studentId)
    if (!item) return

    polishing.value = true
    try {
      const allTags = extractStudentTags(item, tagCategoryList.value)

      const comment = await polishSingleComment(
        {
          name: getStudentName(item),
          tags: allTags,
          comment: currentComment
        },
        aiConfigStore.prompts.singleCommentPolish,
        {
          modelType: aiConfigStore.modelType,
          model: aiConfigStore.model,
          apiKey: aiConfigStore.apiKey,
          baseUrl: aiConfigStore.baseUrl
        }
      )

      const polishedComment = comment.trim()
      if (!polishedComment) {
        ElMessage.warning('AI 未返回有效评语，已保留原内容')
        return
      }

      formData.comment = polishedComment
      ElMessage.success('评语润色成功')
    } catch (error) {
      console.error('润色评语失败:', error)
      ElMessage.error('润色评语失败：' + (error as Error).message)
    } finally {
      polishing.value = false
    }
  }

  onMounted(() => {
    autoFocus()
  })

  return {
    originList,
    tagCategoryList,
    generating,
    polishing,
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
    resetForm,
    editData,
    goToEditTags,
    handleGenerateComment,
    handlePolishComment
  }
}
