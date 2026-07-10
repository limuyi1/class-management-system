import { NAME_PROP } from '@/types/Constants'

import type { StudentDataType } from '@/types/StudentData'

export interface CommentPolishTargetType {
  studentId: string
  name: string
  comment: string
  tags?: string | string[]
}

export interface PolishedCommentResultType {
  studentId: string
  name: string
  comment?: string | null
}

const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

export const buildCommentPolishTargets = (
  students: StudentDataType[],
  getTags?: (student: StudentDataType) => string | string[]
): CommentPolishTargetType[] => {
  return students.reduce<CommentPolishTargetType[]>((targets, student) => {
    const comment = student.comment?.trim()
    if (!comment) return targets

    targets.push({
      studentId: student.studentId,
      name: getStudentName(student),
      comment,
      tags: getTags?.(student)
    })

    return targets
  }, [])
}

export const applyPolishedComments = (
  students: StudentDataType[],
  results: PolishedCommentResultType[]
): number => {
  const resultMap = new Map(
    results
      .map((item) => [item.studentId, item.comment?.trim() || ''] as const)
      .filter(([, comment]) => !!comment)
  )
  let updatedCount = 0

  for (const student of students) {
    const originalComment = student.comment?.trim()
    if (!originalComment) continue

    const polishedComment = resultMap.get(student.studentId)
    if (!polishedComment) continue

    student.comment = polishedComment
    updatedCount++
  }

  return updatedCount
}
