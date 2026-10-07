import { convertScoreToGrade } from '@/utils/score-notice/scoreNoticeGradeUtil'
import { formatExportDate } from '@/utils/downloadUtil'
import { ScoreNoticeCommentStatusEnum, ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import type { NoticeConfigType, TeachingSnapshotType } from '@/types/ApiTeaching'
import type { ScoreNoticeStudentType, ScoreNoticeSubjectType } from '@/types/ScoreNotice'
import type { ExcelCellValueType } from '@/utils/xlsxUtil'

/** 未保存通知设置时按当前满分创建默认值，不按科目名称猜满分。 */
export function defaultNoticeConfig(snapshot: TeachingSnapshotType): NoticeConfigType {
  return {
    title: `${snapshot.scores.workspace.className}成绩通知`,
    noticeDate: formatExportDate(),
    mode: 'score',
    subjects: snapshot.scores.assessments
      .filter((column) => !column.disabled)
      .map((column) => {
        const maxScore = column.fullMark ?? snapshot.scores.workspace.scoreFullMark
        return {
          assessmentId: column.id,
          maxScore,
          gradeAMin: Number((maxScore * 0.8).toFixed(2)),
          gradeBMin: Number((maxScore * 0.6).toFixed(2))
        }
      })
  }
}
/** 通知只能使用本期有效测评；失效配置阻止导出，不能静默漏掉某科。 */
export function buildNoticeProjection(snapshot: TeachingSnapshotType) {
  const config = snapshot.notice.config || defaultNoticeConfig(snapshot)
  const columns = new Map(
    snapshot.scores.assessments
      .filter((column) => !column.disabled)
      .map((column) => [column.id, column])
  )
  const subjects: ScoreNoticeSubjectType[] = config.subjects.map((subject) => {
    const column = columns.get(subject.assessmentId)
    if (!column) throw new Error('通知设置中有已删除或禁用的测评，请修改并保存通知设置')
    return {
      id: column.id,
      label: column.label,
      sourceColumn: column.prop,
      rule: {
        maxScore: subject.maxScore,
        gradeAMin: subject.gradeAMin,
        gradeBMin: subject.gradeBMin
      }
    }
  })
  const comments = new Map(snapshot.comments.map((comment) => [comment.studentId, comment.text]))
  const scores = new Map(
    snapshot.scores.scores.map((score) => [`${score.studentId}/${score.assessmentId}`, score.value])
  )
  const students: ScoreNoticeStudentType[] = snapshot.scores.students
    .filter((student) => !student.disabled && !student.departed)
    .map((student) => {
      const rawValues: ScoreNoticeStudentType['rawValues'] = {}
      const gradeValues: ScoreNoticeStudentType['gradeValues'] = {}
      for (const subject of subjects) {
        rawValues[subject.id] = scores.get(`${student.studentId}/${subject.id}`) ?? null
        gradeValues[subject.id] = convertScoreToGrade(rawValues[subject.id], subject.rule)
      }
      const comment = comments.get(student.studentId) || ''
      return {
        id: student.studentId,
        sourceStudentId: student.studentId,
        name: student.name,
        rawValues,
        gradeValues,
        comment,
        commentStatus: comment
          ? ScoreNoticeCommentStatusEnum.Manual
          : ScoreNoticeCommentStatusEnum.Missing
      }
    })
  return {
    config,
    subjects,
    students,
    mode: config.mode === 'grade' ? ScoreNoticeModeEnum.Grade : ScoreNoticeModeEnum.Score
  }
}
/** 成绩导出默认只含本期有效名单与启用列，历史参照不混入成绩表。 */
export function buildTeachingExcel(
  snapshot: TeachingSnapshotType,
  commentsOnly = false
): { headers: string[]; rows: ExcelCellValueType[][] } {
  const columns = commentsOnly
    ? []
    : snapshot.scores.assessments.filter((column) => !column.disabled)
  const comments = new Map(snapshot.comments.map((comment) => [comment.studentId, comment.text]))
  const scores = new Map(
    snapshot.scores.scores.map((score) => [`${score.studentId}/${score.assessmentId}`, score.value])
  )
  return {
    headers: [
      '序号',
      '学生ID',
      '姓名',
      ...columns.map(
        (column) =>
          `${column.label}（满分 ${column.fullMark ?? snapshot.scores.workspace.scoreFullMark}）`
      ),
      '评语'
    ],
    rows: snapshot.scores.students
      .filter((student) => !student.disabled && !student.departed)
      .map((student, index) => [
        index + 1,
        student.studentId,
        student.name,
        ...columns.map((column) => scores.get(`${student.studentId}/${column.id}`) ?? null),
        comments.get(student.studentId) || ''
      ])
  }
}
