/**
 * 评语字数校验工具
 * 提供评语字数统计与长度校验
 */
/** 评语最小字数 */
export const COMMENT_MIN_LENGTH = 100
/** 评语最大字数 */
export const COMMENT_MAX_LENGTH = 120

/**
 * 统计评语字数（忽略所有空白字符）。
 * @param comment - 评语内容
 * @returns 去空白后的字符数
 */
export function countCommentLength(comment: string | null | undefined): number {
  return (comment || '').replace(/\s/g, '').length
}

/**
 * 校验评语字数并返回错误提示。
 * @param comment - 评语内容
 * @returns 错误提示文本，符合要求时返回空字符串
 */
export function getCommentLengthError(comment: string | null | undefined): string {
  const length = countCommentLength(comment)
  if (!length) return ''
  if (length < COMMENT_MIN_LENGTH) return `当前 ${length} 字，少于 ${COMMENT_MIN_LENGTH} 字`
  if (length > COMMENT_MAX_LENGTH) return `当前 ${length} 字，超过 ${COMMENT_MAX_LENGTH} 字`
  return ''
}
