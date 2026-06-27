import { ref, type Ref } from 'vue'
import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'

import { generateBatchComments, polishBatchComments } from '@/ai/aiService'
import { extractStudentTags } from '@/utils/studentUntil'
import { applyPolishedComments, buildCommentPolishTargets } from '@/utils/commentPolishUntil'
import { COMMENT_MIN_LENGTH, countCommentLength } from '@/utils/commentLengthUntil'
import { NAME_PROP } from '@/types/Constants'
import type { AIConfigType } from '@/types/AIConfig'
import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'

const batchSize = 5

interface EvaluationAIConfigType extends AIConfigType {
  isConfigured: boolean
}

interface UseEvaluationBatchCommentsOptions {
  students: Ref<StudentDataType[]>
  tagCategoryList: Ref<TagCategoryType[]>
  aiConfig: EvaluationAIConfigType
}

type GenerateModeType = 'skip' | 'overwrite'

export function getEvaluationStudentName(student: StudentDataType): string {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

export function formatEvaluationBatchTags(tags: string[]): string {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
  return uniqueTags.length ? uniqueTags.join('、') : ''
}

async function resolveBatchGenerateMode(
  students: StudentDataType[]
): Promise<GenerateModeType | null> {
  const existingCount = students.filter((item) => item.comment && item.comment.trim()).length
  const emptyCount = students.length - existingCount

  if (existingCount === 0) return 'overwrite'

  if (emptyCount === 0) {
    try {
      await ElMessageBox.confirm(
        '所有学生已有期末评语，是否全部重新生成？',
        'AI 批量生成期末评语',
        {
          confirmButtonText: '覆盖所有',
          cancelButtonText: '取消',
          type: 'info',
          distinguishCancelAndClose: true
        }
      )
      return 'overwrite'
    } catch {
      return null
    }
  }

  try {
    await ElMessageBox.confirm(
      `检测到 ${students.length} 名学生中已有 ${existingCount} 名学生有评语，请选择生成方式`,
      'AI 批量生成期末评语',
      {
        confirmButtonText: '覆盖所有',
        cancelButtonText: '仅填充空白期末评语',
        type: 'info',
        distinguishCancelAndClose: true
      }
    )
    return 'overwrite'
  } catch (action) {
    return action === 'cancel' ? 'skip' : null
  }
}

export function useEvaluationBatchComments(options: UseEvaluationBatchCommentsOptions) {
  const batchGenerating = ref(false)
  const batchPolishing = ref(false)

  function getStudentTagsText(student: StudentDataType): string {
    return formatEvaluationBatchTags(extractStudentTags(student, options.tagCategoryList.value))
  }

  function getAIRequestOptions() {
    return {
      modelType: options.aiConfig.modelType,
      model: options.aiConfig.model,
      apiKey: options.aiConfig.apiKey,
      baseUrl: options.aiConfig.baseUrl
    }
  }

  async function handleBatchGenerate(): Promise<void> {
    if (!options.aiConfig.isConfigured) {
      ElMessage.warning('请先在设置页面配置 AI')
      return
    }

    if (!options.students.value.length) {
      ElMessage.warning('没有学生数据')
      return
    }

    const mode = await resolveBatchGenerateMode(options.students.value)
    if (!mode) return

    batchGenerating.value = true
    const loading = ElLoading.service({
      lock: true,
      text: '正在批量生成期末评语...'
    })

    try {
      const filteredStudents = options.students.value.filter(
        (item) => mode === 'overwrite' || !item.comment?.trim()
      )
      const studentsData = filteredStudents.map((item) => ({
        name: getEvaluationStudentName(item),
        tags: getStudentTagsText(item),
        comment: mode === 'overwrite' ? '' : item.comment || ''
      }))
      const totalBatches = Math.ceil(studentsData.length / batchSize)
      const allResults: Array<{ name: string; comment: string | null }> = []
      const failedBatches: number[] = []

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, studentsData.length)
        const batchData = studentsData.slice(start, end)

        loading.setText(`正在生成第 ${batchIndex + 1}/${totalBatches} 批期末评语...`)

        try {
          const result = await generateBatchComments(
            batchData,
            options.aiConfig.prompts.batchComment,
            getAIRequestOptions()
          )

          allResults.push(...(result as Array<{ name: string; comment: string | null }>))
        } catch (error) {
          console.error(`第 ${batchIndex + 1} 批生成失败:`, error)
          failedBatches.push(batchIndex + 1)
        }
      }

      if (failedBatches.length > 0) {
        ElMessage.warning(
          `部分批次生成失败：第 ${failedBatches.join('、')} 批（共 ${totalBatches} 批）`
        )
      }

      let updatedCount = 0
      let tooShortCount = 0
      const resultMap = new Map(
        allResults
          .map((item) => [item.name, item.comment?.trim() || ''] as const)
          .filter(([, comment]) => !!comment)
      )

      for (const student of filteredStudents) {
        const generatedComment = resultMap.get(getEvaluationStudentName(student))
        if (!generatedComment) continue

        if (countCommentLength(generatedComment) < COMMENT_MIN_LENGTH) {
          tooShortCount++
          continue
        }

        student.comment = generatedComment
        updatedCount++
      }

      if (tooShortCount > 0) {
        ElMessage.warning(`有 ${tooShortCount} 条评语少于 100 字，已跳过写入`)
      }

      ElMessage.success(`批量生成完成，已更新 ${updatedCount} 条期末评语`)
    } catch (error) {
      console.error('批量生成期末评语失败:', error)
      ElMessage.error('批量生成期末评语失败：' + (error as Error).message)
    } finally {
      loading.close()
      batchGenerating.value = false
    }
  }

  async function handleBatchPolish(): Promise<void> {
    if (!options.aiConfig.isConfigured) {
      ElMessage.warning('请先在设置页面配置 AI')
      return
    }

    const polishTargets = buildCommentPolishTargets(options.students.value, getStudentTagsText)

    if (!polishTargets.length) {
      ElMessage.warning('当前没有可润色的已有评语')
      return
    }

    try {
      await ElMessageBox.confirm(
        `将基于当前已有评语润色 ${polishTargets.length} 名学生，空白评语不会生成或覆盖。是否继续？`,
        'AI 批量润色期末评语',
        {
          confirmButtonText: '开始润色',
          cancelButtonText: '取消',
          type: 'info'
        }
      )
    } catch {
      return
    }

    batchPolishing.value = true
    const loading = ElLoading.service({
      lock: true,
      text: '正在批量润色期末评语...'
    })

    try {
      const totalBatches = Math.ceil(polishTargets.length / batchSize)
      const allResults: Array<{ name: string; comment?: string | null }> = []
      const failedBatches: number[] = []

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, polishTargets.length)
        const batchData = polishTargets.slice(start, end)

        loading.setText(`正在润色第 ${batchIndex + 1}/${totalBatches} 批期末评语...`)

        try {
          const result = await polishBatchComments(
            batchData,
            options.aiConfig.prompts.batchCommentPolish,
            getAIRequestOptions()
          )

          allResults.push(...result)
        } catch (error) {
          console.error(`第 ${batchIndex + 1} 批润色失败:`, error)
          failedBatches.push(batchIndex + 1)
        }
      }

      if (failedBatches.length > 0) {
        ElMessage.warning(
          `部分批次润色失败：第 ${failedBatches.join('、')} 批（共 ${totalBatches} 批）`
        )
      }

      const updatedCount = applyPolishedComments(options.students.value, allResults)
      ElMessage.success(`批量润色完成，已更新 ${updatedCount} 条期末评语`)
    } catch (error) {
      console.error('批量润色期末评语失败:', error)
      ElMessage.error('批量润色期末评语失败：' + (error as Error).message)
    } finally {
      loading.close()
      batchPolishing.value = false
    }
  }

  return {
    batchGenerating,
    batchPolishing,
    handleBatchGenerate,
    handleBatchPolish
  }
}
