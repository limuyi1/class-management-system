import { defineStore } from 'pinia'

import { ScoreNoticeCommentStatusEnum, ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import { recalculateNoticeGrades } from '@/utils/score-notice/scoreNoticeImportUtil'
import { getScoreNoticeCommentValidationReasons } from '@/utils/score-notice/scoreNoticeCommentUtil'

import type {
  ScoreNoticeGradeRuleType,
  ScoreNoticeImportResultType,
  ScoreNoticeStateType
} from '@/types/ScoreNotice'

/** 格式化当前日期为 YYYY-MM-DD 字符串 */
const formatToday = (): string => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 创建成绩通知单的默认初始状态 */
const createDefaultState = (): ScoreNoticeStateType => ({
  /** 通知单标题 */
  title: '期中考试等级通知',
  /** 通知日期（YYYY-MM-DD） */
  noticeDate: formatToday(),
  /** 当前展示模式（等级制/分数制） */
  mode: ScoreNoticeModeEnum.Grade,
  /** 来源数据模式 */
  sourceMode: ScoreNoticeModeEnum.Grade,
  /** 来源文件名 */
  sourceFileName: '',
  /** 科目列表 */
  subjects: [],
  /** 学生列表 */
  students: [],
  /** 当前选中的学生 ID */
  selectedStudentId: ''
})

/**
 * 成绩通知单状态管理
 * 管理等级制/分数制通知单的导入、学生列表、评语编辑和科目等级规则
 */
export const useScoreNoticeStore = defineStore('scoreNotice', {
  state: (): ScoreNoticeStateType => createDefaultState(),
  getters: {
    /**
     * 当前选中的学生
     * @returns 选中的学生对象，未选中返回 null
     */
    selectedStudent: (state) =>
      state.students.find((student) => student.id === state.selectedStudentId) || null,
    /** 已生成（含人工编辑）评语的学生数量 */
    generatedCount: (state) =>
      state.students.filter((student) =>
        [ScoreNoticeCommentStatusEnum.Generated, ScoreNoticeCommentStatusEnum.Manual].includes(
          student.commentStatus
        )
      ).length,
    /** 待生成或生成失败的学生数量 */
    pendingCount: (state) =>
      state.students.filter((student) =>
        [ScoreNoticeCommentStatusEnum.Pending, ScoreNoticeCommentStatusEnum.Failed].includes(
          student.commentStatus
        )
      ).length,
    /** 缺少成绩数据的学生数量 */
    missingCount: (state) =>
      state.students.filter(
        (student) => student.commentStatus === ScoreNoticeCommentStatusEnum.Missing
      ).length,
    /** 需要人工复核的学生数量 */
    reviewCount: (state) =>
      state.students.filter(
        (student) => student.commentStatus === ScoreNoticeCommentStatusEnum.NeedsReview
      ).length
  },
  actions: {
    /**
     * 应用导入结果，重置通知单数据
     * @param result - 解析后的导入结果
     * @param sourceFileName - 来源文件名
     */
    applyImport(result: ScoreNoticeImportResultType, sourceFileName: string) {
      this.sourceMode = result.sourceMode
      this.mode = ScoreNoticeModeEnum.Grade
      this.sourceFileName = sourceFileName
      this.subjects = result.subjects
      this.students = result.students
      this.selectedStudentId = result.students[0]?.id || ''
    },
    /**
     * 选中学生
     * @param studentId - 学生 ID
     */
    selectStudent(studentId: string) {
      this.selectedStudentId = studentId
    },
    /**
     * 更新学生评语并校验，根据校验结果更新状态
     * @param studentId - 学生 ID
     * @param comment - 评语内容
     * @param manual - 是否人工编辑（默认为 true）
     */
    updateStudentComment(studentId: string, comment: string, manual = true) {
      const student = this.students.find((item) => item.id === studentId)
      if (!student) return
      student.comment = comment
      const validationReasons = getScoreNoticeCommentValidationReasons(comment)
      student.validationReasons = validationReasons
      student.errorMessage = validationReasons.join('；') || undefined
      // 有校验问题标记为需复核，否则按人工/自动来源标记状态
      student.commentStatus = validationReasons.length
        ? ScoreNoticeCommentStatusEnum.NeedsReview
        : manual
          ? ScoreNoticeCommentStatusEnum.Manual
          : ScoreNoticeCommentStatusEnum.Generated
    },
    /**
     * 更新学生评语生成状态
     * @param studentId - 学生 ID
     * @param status - 目标状态
     * @param errorMessage - 可选错误信息
     */
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
    /**
     * 更新科目等级规则并按新规则重算所有学生等级
     * @param subjectId - 科目 ID
     * @param rule - 新的等级规则
     */
    updateSubjectRule(subjectId: string, rule: ScoreNoticeGradeRuleType) {
      const subject = this.subjects.find((item) => item.id === subjectId)
      if (!subject) return
      subject.rule = { ...rule }
      this.students = recalculateNoticeGrades({
        subjects: this.subjects,
        students: this.students
      })
    },
    /** 重置成绩通知单为默认初始状态 */
    resetNotice() {
      this.$patch(createDefaultState())
    }
  }
})
