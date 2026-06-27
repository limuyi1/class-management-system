export const COMMENT_MIN_LENGTH = 100
export const COMMENT_MAX_LENGTH = 120

export function countCommentLength(comment: string | null | undefined): number {
  return (comment || '').replace(/\s/g, '').length
}

export function getCommentLengthError(comment: string | null | undefined): string {
  const length = countCommentLength(comment)
  if (!length) return ''
  if (length < COMMENT_MIN_LENGTH) return `当前 ${length} 字，少于 ${COMMENT_MIN_LENGTH} 字`
  if (length > COMMENT_MAX_LENGTH) return `当前 ${length} 字，超过 ${COMMENT_MAX_LENGTH} 字`
  return ''
}
