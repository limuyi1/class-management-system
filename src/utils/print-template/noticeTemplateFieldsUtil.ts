import { ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import { formatScoreValue } from '@/utils/score-notice/scoreNoticeGradeUtil'

import type { ScoreNoticeStudentType, ScoreNoticeSubjectType } from '@/types/ScoreNotice'

/** 通知内容映射为通用变量；0 分和空值分别保留，不依赖姓名连接。 */
export function getNoticeTemplateFields(
  student: ScoreNoticeStudentType,
  subjects: ScoreNoticeSubjectType[],
  mode: ScoreNoticeModeEnum,
  title: string,
  date: string
): Record<string, string> {
  const fields: Record<string, string> = {
    姓名: student.name,
    评语: student.comment,
    标题: title,
    日期: date
  }
  subjects.forEach((subject, index) => {
    const grade = student.gradeValues[subject.id]
    fields[`科目${index + 1}`] = subject.label
    fields[`成绩${index + 1}`] =
      mode === ScoreNoticeModeEnum.Score
        ? formatScoreValue(student.rawValues[subject.id])
        : grade || '--'
    fields[`等级描述${index + 1}`] =
      grade === 'A'
        ? '表现优秀'
        : grade === 'B'
          ? '表现良好'
          : grade === 'C'
            ? '继续努力'
            : '暂无数据'
  })
  return fields
}
