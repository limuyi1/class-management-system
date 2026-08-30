import { computed, onMounted, reactive, ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { match } from 'pinyin-pro'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useEnterUp } from '@/hooks/useEnterUp'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'

import { generateSingleComment, polishSingleComment } from '@/ai/aiService'
import { extractStudentTags } from '@/utils/studentUtil'

import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'
import { NAME_PROP } from '@/constants'

interface UseEvaluationInputOptions {
  /** 选中学生时的滚动回调 */
  onScroll: (studentId: string) => void
  /** 提交后是否自动跳到下一个学生 */
  autoNextOnSubmit?: boolean
  /** 切换学生时如未保存是否弹窗确认 */
  promptUnsavedOnSwitch?: boolean
  /** 当前激活学生变化回调 */
  onActiveStudentChange?: (student: StudentDataType | null) => void
  /** 外部传入的学生列表 */
  students?: Ref<StudentDataType[]>
  /** 外部传入的标签分类列表 */
  tagCategoryList?: Ref<TagCategoryType[]>
  /** 是否允许编辑标签 */
  allowTagEditing?: boolean
}

/** 录入表单数据 */
interface InputFormDataType {
  /** 当前学生 ID */
  studentId: string | null
  /** 学生姓名（显示用） */
  name: string
  /** 评语内容 */
  comment: string | null
}

/** 可聚焦元素接口（用于输入框 ref） */
interface FocusableType {
  /** 聚焦元素 */
  focus: () => void
}

/**
 * 期末评语录入交互逻辑
 * 提供学生搜索选择、评语编辑、AI 生成/润色、标签跳转等完整录入体验
 * @param options - 录入交互配置项
 * @returns 录入相关的响应式状态与操作方法集合
 */
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

  const { students: systemStudents } = storeToRefs(dataStore)
  const { tagCategories: systemTagCategories } = storeToRefs(settingStore)
  const originList = options.students ?? systemStudents
  const tagCategoryList = options.tagCategoryList ?? systemTagCategories
  const allowTagEditing = options.allowTagEditing ?? true

  /** 按学生 ID 在来源列表中查找学生 */
  const getStudentById = (studentId: string): StudentDataType | undefined =>
    originList.value.find((student) => student.studentId === studentId)

  /** AI 评语生成中状态 */
  const generating = ref(false)
  /** AI 评语润色中状态 */
  const polishing = ref(false)
  /** 搜索候选学生列表 */
  const optionsList = ref<StudentDataType[]>([])
  /** 当前选中的学生 ID */
  const currentSelectedStudentId = ref<string | null>(null)

  /** 姓名输入框 ref */
  const nameInputRef = ref<FocusableType | null>(null)
  /** 评语输入框 ref */
  const commentInputRef = ref<FocusableType | null>(null)

  /** 录入表单数据 */
  const formData = reactive<InputFormDataType>({
    studentId: null,
    name: '',
    comment: null
  })

  /** 当前学生的标签映射（分类 prop -> 标签数组） */
  const currentStudentTags = computed<Record<string, string[]> | null>(() => {
    if (!formData.studentId) return null
    const item = getStudentById(formData.studentId)
    if (!item || !item.tags) return {}
    return item.tags
  })

  /** 当前学生是否拥有任意标签 */
  const hasAnyTags = computed(() => {
    const tags = currentStudentTags.value
    if (!tags || Object.keys(tags).length === 0) return false
    for (const category of tagCategoryList.value) {
      const tagList = tags[category.prop]
      if (tagList && tagList.length > 0) return true
    }
    return false
  })

  /** 聚焦姓名输入框 */
  const autoFocus = () => {
    nameInputRef.value?.focus()
  }

  /** 获取学生显示名称，缺失时返回空字符串 */
  const getStudentName = (student: StudentDataType): string => {
    const name = student[NAME_PROP]
    return name === null || name === undefined ? '' : String(name)
  }

  /**
   * 远程搜索学生（支持姓名精确包含与拼音匹配）
   * @param query - 搜索关键词
   */
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

  /**
   * 将指定学生数据填充到表单
   * @param studentId - 学生 ID
   */
  const fillStudentData = (studentId: string | null) => {
    if (!studentId) return
    const item = getStudentById(studentId)
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

  /** 规范化评语文本（去除首尾空白） */
  const normalizeComment = (comment: string | null | undefined): string => {
    if (!comment) return ''
    return comment.trim()
  }

  /** 判断当前表单评语是否有未保存的修改 */
  const hasUnsavedChanges = () => {
    if (!formData.studentId) return false
    const currentItem = getStudentById(formData.studentId)
    if (!currentItem) return false

    return normalizeComment(formData.comment) !== normalizeComment(currentItem.comment || '')
  }

  /** 保存当前表单评语到学生数据，成功返回 true */
  const saveCurrentData = () => {
    if (!formData.studentId) return false

    const item = getStudentById(formData.studentId)
    if (!item) return false

    item.comment = formData.comment?.trim() ? formData.comment : undefined

    return true
  }

  /**
   * 尝试切换学生，存在未保存修改时弹窗确认
   * @param nextStudentId - 目标学生 ID
   */
  const trySwitchStudent = async (nextStudentId: string) => {
    if (!getStudentById(nextStudentId)) return
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

  /** 下拉选择学生变化时的处理 */
  const selectChange = (studentId: string) => {
    trySwitchStudent(studentId)
  }

  // 在姓名输入框按回车时填充当前选中的学生
  useEnterUp('stuName', () => {
    fillStudentData(currentSelectedStudentId.value)
  })

  /** 重置录入表单 */
  const resetForm = () => {
    formData.studentId = null
    formData.name = ''
    formData.comment = null
    optionsList.value = []
    onActiveStudentChange?.(null)
    autoFocus()
  }

  /** 提交当前评语，并根据配置跳转下一名学生或重置表单 */
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

  /**
   * 外部定位到指定学生进行编辑
   * @param data - 学生数据
   */
  const editData = (data: StudentDataType) => {
    const name = getStudentName(data)
    remoteMethod(name)

    trySwitchStudent(data.studentId)
  }

  /** 跳转到学生标签编辑页 */
  const goToEditTags = () => {
    if (!allowTagEditing || !formData.studentId) return
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

  /** 调用 AI 为当前学生生成评语 */
  const handleGenerateComment = async () => {
    if (!formData.studentId) return

    if (!aiConfigStore.isConfigured) {
      ElMessage.warning('请先在设置页面配置 AI')
      return
    }

    const item = getStudentById(formData.studentId)
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

  /** 调用 AI 润色当前评语 */
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

    const item = getStudentById(formData.studentId)
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
    allowTagEditing,
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
