import { ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { startLoading, stopLoading, updateLoadingText } from '@/hooks/useLoading'

import { generateBatchComments, polishBatchComments } from '@/ai/aiService'
import { extractStudentTags } from '@/utils/studentUtil'
import { applyPolishedComments, buildCommentPolishTargets } from '@/utils/evaluation/commentPolishUtil'
import { COMMENT_MIN_LENGTH, countCommentLength } from '@/utils/evaluation/commentLengthUtil'
import { NAME_PROP } from '@/constants'
import type { AIConfigType } from '@/types/AIConfig'
import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'

/** AI 批量生成/润色时每批处理的学生数量 */
const batchSize = 5
/** 同一经典表达在批次间被允许重复使用的上限 */
const maxClassicExpressionUsage = 2

/** 组合了 AI 配置与“是否已配置”标记的配置类型 */
interface EvaluationAIConfigType extends AIConfigType {
  isConfigured: boolean
}

/** 批量评语生成/润色组合式函数的入参 */
interface UseEvaluationBatchCommentsOptions {
  students: Ref<StudentDataType[]>
  tagCategoryList: Ref<TagCategoryType[]>
  aiConfig: EvaluationAIConfigType
}

/** 批量生成的覆盖策略：仅填充空白或覆盖所有 */
export type EvaluationBatchGenerateModeType = 'skip' | 'overwrite'
/** 经典表达的已使用次数统计 */
type ClassicExpressionUsageType = { expression: string; count: number }
/** AI 返回的单条评语结果 */
type CommentAIResultType = {
  studentId: string
  name: string
  comment?: string | null
  classicExpression?: string | null
}

/**
 * 读取学生姓名并兜底为空字符串。
 *
 * @param student 学生数据
 * @returns 学生姓名（非字符串统一转为文本）
 */
export function getEvaluationStudentName(student: StudentDataType): string {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

/**
 * 将标签数组去重、去除空白后以顿号拼接。
 *
 * @param tags 标签数组
 * @returns 拼接后的标签文本，空数组返回空字符串
 */
export function formatEvaluationBatchTags(tags: string[]): string {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
  return uniqueTags.length ? uniqueTags.join('、') : ''
}

/**
 * 归一化 AI 返回的经典表达：去除首尾引号/书名号与句末标点。
 *
 * @param expression 原始表达
 * @returns 归一化后的表达文本
 */
export function normalizeClassicExpression(expression: string | null | undefined): string {
  return String(expression || '')
    .trim()
    .replace(/^[“”"『』「」《》]+|[“”"『』「」《》]+$/g, '')
    .replace(/[。.!！?？；;：:]+$/g, '')
    .trim()
}

/** 找出使用次数已达到上限的经典表达，用于后续批次规避重复 */
function getOverusedClassicExpressions(
  usageMap: Map<string, number>
): ClassicExpressionUsageType[] {
  return Array.from(usageMap.entries())
    .filter(([, count]) => count >= maxClassicExpressionUsage)
    .map(([expression, count]) => ({ expression, count }))
}

/** 累计本批结果中每个经典表达的使用次数 */
function recordClassicExpressionUsage(
  usageMap: Map<string, number>,
  results: CommentAIResultType[]
) {
  results.forEach((item) => {
    const expression = normalizeClassicExpression(item.classicExpression)
    if (!expression) return
    usageMap.set(expression, (usageMap.get(expression) || 0) + 1)
  })
}

/**
 * 根据学生已有评语情况，通过弹窗确认批量生成的覆盖模式。
 *
 * @param students 待处理学生列表
 * @returns 覆盖模式；用户取消时返回 null
 */
async function resolveBatchGenerateMode(
  students: StudentDataType[]
): Promise<EvaluationBatchGenerateModeType | null> {
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

/**
 * 管理 AI 批量生成与润色期末评语的完整流程。
 *
 * 生成/润色均按批次调用 AI，支持“仅填充空白”或“覆盖全部”两种模式，
 * 并维护经典表达复用次数，避免多批次产出雷同评语。
 *
 * @param options 学生列表、标签分类与 AI 配置
 * @returns 生成/润色状态及触发方法
 */
export function useEvaluationBatchComments(options: UseEvaluationBatchCommentsOptions) {
  const batchGenerating = ref(false)
  const batchPolishing = ref(false)

  /**
   * 提取学生标签并格式化为顿号分隔的文本。
   *
   * @param student 学生数据
   * @returns 拼接后的标签文本
   */
  function getStudentTagsText(student: StudentDataType): string {
    return formatEvaluationBatchTags(extractStudentTags(student, options.tagCategoryList.value))
  }

  /** 组装调用 AI 所需的模型、密钥与地址配置 */
  function getAIRequestOptions() {
    return {
      modelType: options.aiConfig.modelType,
      model: options.aiConfig.model,
      apiKey: options.aiConfig.apiKey,
      baseUrl: options.aiConfig.baseUrl
    }
  }

  /**
   * 按批次调用 AI 批量生成期末评语。
   *
   * @param requestedMode 指定覆盖模式；未指定时根据已有评语情况弹窗确认
   */
  async function handleBatchGenerate(
    requestedMode?: EvaluationBatchGenerateModeType
  ): Promise<void> {
    if (!options.aiConfig.isConfigured) {
      ElMessage.warning('请先在设置页面配置 AI')
      return
    }

    if (!options.students.value.length) {
      ElMessage.warning('没有学生数据')
      return
    }

    const mode = requestedMode ?? (await resolveBatchGenerateMode(options.students.value))
    if (!mode) return

    if (mode === 'skip' && options.students.value.every((item) => item.comment?.trim())) {
      ElMessage.info('当前没有空白评语需要生成')
      return
    }

    batchGenerating.value = true
    startLoading('正在批量生成期末评语...')

    try {
      // overwrite 处理全部学生；skip 仅处理尚无评语的空白项
      const filteredStudents = options.students.value.filter(
        (item) => mode === 'overwrite' || !item.comment?.trim()
      )
      const studentsData = filteredStudents.map((item) => ({
        studentId: item.studentId,
        name: getEvaluationStudentName(item),
        tags: getStudentTagsText(item),
        comment: mode === 'overwrite' ? '' : item.comment || ''
      }))
      const totalBatches = Math.ceil(studentsData.length / batchSize)
      const allResults: CommentAIResultType[] = []
      const failedBatches: number[] = []
      const classicExpressionUsageMap = new Map<string, number>()

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, studentsData.length)
        const batchData = studentsData.slice(start, end)

        updateLoadingText(`正在生成第 ${batchIndex + 1}/${totalBatches} 批期末评语...`)

        try {
          const result = await generateBatchComments(
            batchData,
            options.aiConfig.prompts.batchComment,
            getAIRequestOptions(),
            {
              classicExpressionUsages: getOverusedClassicExpressions(classicExpressionUsageMap),
              maxClassicExpressionUsage
            }
          )

          const batchResults = result as CommentAIResultType[]
          allResults.push(...batchResults)
          recordClassicExpressionUsage(classicExpressionUsageMap, batchResults)
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
      // 以学生 ID 为键汇总各批次结果，重复返回时保留最后一次
      const resultMap = new Map(
        allResults
          .map((item) => [item.studentId, item.comment?.trim() || ''] as const)
          .filter(([, comment]) => !!comment)
      )

      for (const student of filteredStudents) {
        const generatedComment = resultMap.get(student.studentId)
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
      stopLoading()
      batchGenerating.value = false
    }
  }

  /** 按批次调用 AI 润色已有评语，空白评语不会生成或覆盖 */
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
    startLoading('正在批量润色期末评语...')

    try {
      const totalBatches = Math.ceil(polishTargets.length / batchSize)
      const allResults: CommentAIResultType[] = []
      const failedBatches: number[] = []
      const classicExpressionUsageMap = new Map<string, number>()

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, polishTargets.length)
        const batchData = polishTargets.slice(start, end)

        updateLoadingText(`正在润色第 ${batchIndex + 1}/${totalBatches} 批期末评语...`)

        try {
          const result = await polishBatchComments(
            batchData,
            options.aiConfig.prompts.batchCommentPolish,
            getAIRequestOptions(),
            {
              classicExpressionUsages: getOverusedClassicExpressions(classicExpressionUsageMap),
              maxClassicExpressionUsage
            }
          )

          allResults.push(...result)
          recordClassicExpressionUsage(classicExpressionUsageMap, result)
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
      stopLoading()
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
