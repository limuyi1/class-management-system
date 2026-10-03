/** 提示词占位值、学生身份约束与批量表达控制。 */
import type { AIStudentDataType, BatchCommentOptionsType } from '@/types/AIService'

/** 将模板占位值格式化为可读文本（数组拼接、空值返回「暂无」） */
export function formatTemplateValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (!value.length) return '暂无'

    const containsObject = value.some((item) => typeof item === 'object' && item !== null)
    return containsObject ? JSON.stringify(value, null, 2) : value.join('、')
  }

  if (value === null || value === undefined) {
    return '暂无'
  }

  return String(value)
}

/** 将模板中的 {{key}} 占位符替换为对应数据 */
export function replaceTemplate(template: string, data: Record<string, unknown>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, formatTemplateValue(value))
  }
  return result
}

/** 将标签数据规范化为提示词所需的顿号分隔字符串 */
export function normalizeTagsForPrompt(tags: AIStudentDataType['tags']): string {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join('、')
  }

  return tags?.trim() || ''
}

/** 构建批量评语请求中单个学生的载荷 */
export function buildCommentStudentPayload(
  student: AIStudentDataType
): Pick<AIStudentDataType, 'studentId' | 'name' | 'tags' | 'comment'> {
  return {
    studentId: student.studentId,
    name: student.name,
    tags: normalizeTagsForPrompt(student.tags),
    comment: student.comment || ''
  }
}

/** 生成学生身份约束提示，确保模型按 studentId 返回结果 */
export function buildStudentIdentityGuidance(): string {
  return `

学生身份约束：
1. 每条输入都包含 studentId，返回结果必须原样返回对应的 studentId。
2. 不得新增、删除、修改、交换 studentId。
3. 系统只按 studentId 写回结果，缺少 studentId 的结果将被忽略。`
}

/** 生成经典表达频率控制的提示 */
export function buildClassicExpressionUsageGuidance(options?: BatchCommentOptionsType): string {
  const usages = options?.classicExpressionUsages || []
  if (!usages.length) return ''

  const maxUsage = options?.maxClassicExpressionUsage || 2
  const usageText = usages
    .map((item) => `- ${item.expression}（已使用 ${item.count} 次）`)
    .join('\n')

  return `\n\n经典表达频率控制：
1. 同一句经典表达在本次全班评语中最多使用 ${maxUsage} 次；达到 ${maxUsage} 次后，除非与学生标签和成长方向高度贴合，否则不要继续使用。
2. 同一批次内不得重复使用同一句经典表达。
3. 以下经典表达已在前面批次使用较多，本批次请优先避开：
${usageText}
4. 每条结果必须额外返回 classicExpression 字段，填写本条评语实际使用的经典表达；若确实未使用，则填空字符串。classicExpression 不要包含解释、出处或额外修饰。`
}
