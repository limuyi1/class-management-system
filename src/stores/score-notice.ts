import { defineStore } from 'pinia'

import { ScoreNoticeCommentStatusEnum, ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import { recalculateNoticeGrades } from '@/utils/scoreNoticeImportUntil'
import { getScoreNoticeCommentValidationReasons } from '@/utils/scoreNoticeCommentUntil'

import type {
  ScoreNoticeGradeRuleType,
  ScoreNoticeImportResultType,
  ScoreNoticeStateType
} from '@/types/ScoreNotice'

const formatToday = (): string => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createDefaultState = (): ScoreNoticeStateType => ({
  title: '期中考试等级通知',
  noticeDate: formatToday(),
  mode: ScoreNoticeModeEnum.Grade,
  sourceMode: ScoreNoticeModeEnum.Grade,
  sourceFileName: '',
  subjects: [],
  students: [],
  selectedStudentId: ''
})

/**
 * 成绩通知单状态管理
 * 管理等级制/分数制通知单的导入、学生列表、评语编辑和科目等级规则
 */
export const useScoreNoticeStore = defineStore('scoreNotice', {
  state: (): ScoreNoticeStateType => createDefaultState(),
  getters: {
    selectedStudent: (state) =>
      state.students.find((student) => student.id === state.selectedStudentId) || null,
    generatedCount: (state) =>
      state.students.filter((student) =>
        [ScoreNoticeCommentStatusEnum.Generated, ScoreNoticeCommentStatusEnum.Manual].includes(
          student.commentStatus
        )
      ).length,
    pendingCount: (state) =>
      state.students.filter((student) =>
        [ScoreNoticeCommentStatusEnum.Pending, ScoreNoticeCommentStatusEnum.Failed].includes(
          student.commentStatus
        )
      ).length,
    missingCount: (state) =>
      state.students.filter(
        (student) => student.commentStatus === ScoreNoticeCommentStatusEnum.Missing
      ).length,
    reviewCount: (state) =>
      state.students.filter(
        (student) => student.commentStatus === ScoreNoticeCommentStatusEnum.NeedsReview
      ).length
  },
  actions: {
    applyImport(result: ScoreNoticeImportResultType, sourceFileName: string) {
      this.sourceMode = result.sourceMode
      this.mode = ScoreNoticeModeEnum.Grade
      this.sourceFileName = sourceFileName
      this.subjects = result.subjects
      this.students = result.students
      this.selectedStudentId = result.students[0]?.id || ''
    },
    selectStudent(studentId: string) {
      this.selectedStudentId = studentId
    },
    updateStudentComment(studentId: string, comment: string, manual = true) {
      const student = this.students.find((item) => item.id === studentId)
      if (!student) return
      student.comment = comment
      const validationReasons = getScoreNoticeCommentValidationReasons(comment)
      student.validationReasons = validationReasons
      student.errorMessage = validationReasons.join('；') || undefined
      student.commentStatus = validationReasons.length
        ? ScoreNoticeCommentStatusEnum.NeedsReview
        : manual
          ? ScoreNoticeCommentStatusEnum.Manual
          : ScoreNoticeCommentStatusEnum.Generated
    },
    updateCommentStatus(
      studentId: string,
      status: ScoreNoticeCommentStatusEnum,
      errorMessage?: string
    ) {
      const student = this.students.find((item) => item.id === studentId)
      if (!student) return
      student.commentStatus = status
      student.errorMessage = errorMessage
    },
    updateSubjectRule(subjectId: string, rule: ScoreNoticeGradeRuleType) {
      const subject = this.subjects.find((item) => item.id === subjectId)
      if (!subject) return
      subject.rule = { ...rule }
      this.students = recalculateNoticeGrades({
        subjects: this.subjects,
        students: this.students
      })
    },
    resetNotice() {
      this.$patch(createDefaultState())
    }
  }
})
