import { defineStore } from 'pinia'

import { createDefaultTeacherScheduleState, createId, getTermLabel } from '@/views/tools/teacher-schedule/constants'
import type {
  TeacherScheduleAssignmentRoleType,
  TeacherScheduleAssignmentType,
  TeacherScheduleClassType,
  TeacherScheduleConflictSeverityType,
  TeacherScheduleConflictTypeRecord,
  TeacherScheduleConstraintType,
  TeacherScheduleCourseType,
  TeacherScheduleGradeCourseTemplateType,
  TeacherSchedulePlanStatusType,
  TeacherSchedulePlanType,
  TeacherScheduleStateType,
  TeacherScheduleTeacherConstraintType,
  TeacherScheduleTeacherStatusType,
  TeacherScheduleTeacherType,
  TeacherScheduleTeachingHistoryType,
  TeacherScheduleTermType
} from '@/types/TeacherSchedule'

interface TeacherLoadMapType {
  [teacherId: string]: number
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const upsertRecord = <T extends { id: string }>(list: T[], record: T): void => {
  const index = list.findIndex((item) => item.id === record.id)
  if (index === -1) {
    list.push(record)
    return
  }
  list[index] = record
}

const removeRecord = <T extends { id: string }>(list: T[], id: string): void => {
  const index = list.findIndex((item) => item.id === id)
  if (index !== -1) {
    list.splice(index, 1)
  }
}

const isTeacherActive = (status: TeacherScheduleTeacherStatusType): boolean => {
  return status === 'on-duty'
}

const isPlanStatus = (status: TeacherSchedulePlanStatusType): boolean => {
  return status === 'draft' || status === 'confirmed' || status === 'published' || status === 'archived'
}

const buildConflict = (
  planId: string,
  conflictType: TeacherScheduleConflictTypeRecord['conflictType'],
  severity: TeacherScheduleConflictSeverityType,
  targetType: TeacherScheduleConflictTypeRecord['targetType'],
  targetId: string,
  message: string
): TeacherScheduleConflictTypeRecord => {
  return {
    id: createId('conflict'),
    planId,
    conflictType,
    severity,
    targetType,
    targetId,
    message,
    resolved: false,
    resolvedBy: '',
    resolvedAt: ''
  }
}

const createPlanSummary = (
  assignments: TeacherScheduleAssignmentType[],
  conflicts: TeacherScheduleConflictTypeRecord[]
): string => {
  return `已生成 ${assignments.length} 条分配记录，发现 ${conflicts.length} 个待处理问题`
}

const getTeacherLoad = (assignments: TeacherScheduleAssignmentType[]): TeacherLoadMapType => {
  return assignments.reduce<TeacherLoadMapType>((accumulator, item) => {
    if (item.role !== 'course') return accumulator
    accumulator[item.teacherId] = (accumulator[item.teacherId] || 0) + item.weeklyHours
    return accumulator
  }, {})
}

const parseConstraintValueList = (value: string): string[] => {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const hasConstraintValue = (
  constraints: TeacherScheduleTeacherConstraintType[],
  teacherId: string,
  termId: string,
  constraintType: TeacherScheduleConstraintType,
  value?: string
): boolean => {
  return constraints.some((constraint) => {
    if (
      constraint.teacherId !== teacherId ||
      constraint.termId !== termId ||
      constraint.scope !== 'hard' ||
      constraint.constraintType !== constraintType
    ) {
      return false
    }

    if (!constraint.constraintValue.trim()) {
      return true
    }

    if (!value) {
      return true
    }

    return parseConstraintValueList(constraint.constraintValue).includes(value)
  })
}

const teacherHasCrossClassConflict = (
  teacherId: string,
  classId: string,
  assignments: TeacherScheduleAssignmentType[]
): boolean => {
  return assignments.some(
    (assignment) => assignment.teacherId === teacherId && assignment.classId !== classId
  )
}

const teacherHasCrossGradeConflict = (
  teacherId: string,
  grade: string,
  assignments: TeacherScheduleAssignmentType[],
  classLookup: Map<string, TeacherScheduleClassType>
): boolean => {
  return assignments.some((assignment) => {
    if (assignment.teacherId !== teacherId) return false
    const assignedClass = classLookup.get(assignment.classId)
    if (!assignedClass) return false
    return assignedClass.grade !== grade
  })
}

const buildTeacherHistoryScore = (
  histories: TeacherScheduleTeachingHistoryType[],
  teacherId: string,
  classId: string,
  courseId: string | null,
  role: TeacherScheduleAssignmentRoleType
): number => {
  return histories.reduce((score, history) => {
    if (history.teacherId !== teacherId || history.role !== role) {
      return score
    }

    if (role === 'head-teacher' && history.classId === classId) {
      return score + 100
    }

    if (role === 'course') {
      if (history.classId === classId && history.courseId === courseId) {
        return score + 120
      }

      if (history.courseId === courseId) {
        return score + 70
      }
    }

    return score
  }, 0)
}

const buildCourseCandidateScore = (
  teacher: TeacherScheduleTeacherType,
  course: TeacherScheduleCourseType,
  template: TeacherScheduleGradeCourseTemplateType,
  histories: TeacherScheduleTeachingHistoryType[],
  classItem: TeacherScheduleClassType,
  teacherLoad: TeacherLoadMapType,
  constraints: TeacherScheduleTeacherConstraintType[],
  currentAssignments: TeacherScheduleAssignmentType[],
  classLookup: Map<string, TeacherScheduleClassType>
): number | null => {
  if (!isTeacherActive(teacher.status)) return null
  if (teacherLoad[teacher.id] >= teacher.maxWeeklyHours) return null
  if (
    hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-teach-course', course.id) ||
    hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-teach-course', course.name) ||
    hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-teach-course', course.shortName)
  ) {
    return null
  }
  if (hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-teach-grade', classItem.grade)) {
    return null
  }
  if (hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-teach-role', 'course')) {
    return null
  }
  if (course.isMainCourse && hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-main-course')) {
    return null
  }

  if (
    hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-cross-class') &&
    teacherHasCrossClassConflict(teacher.id, classItem.id, currentAssignments)
  ) {
    return null
  }

  if (
    hasConstraintValue(constraints, teacher.id, template.termId, 'cannot-cross-grade') &&
    teacherHasCrossGradeConflict(teacher.id, classItem.grade, currentAssignments, classLookup)
  ) {
    return null
  }

  if (!teacher.canCrossClass && teacherHasCrossClassConflict(teacher.id, classItem.id, currentAssignments)) {
    return null
  }

  if (
    !teacher.canCrossGrade &&
    teacherHasCrossGradeConflict(teacher.id, classItem.grade, currentAssignments, classLookup)
  ) {
    return null
  }

  if (!course.allowCrossClass && teacherHasCrossClassConflict(teacher.id, classItem.id, currentAssignments)) {
    return null
  }

  if (
    !course.allowCrossGrade &&
    teacherHasCrossGradeConflict(teacher.id, classItem.grade, currentAssignments, classLookup)
  ) {
    return null
  }

  if (!teacher.courseIds.includes(course.id) && teacher.mainSubject !== course.name) {
    return null
  }

  const nextLoad = (teacherLoad[teacher.id] || 0) + template.weeklyHours
  if (nextLoad > teacher.maxWeeklyHours) {
    return null
  }

  let score = 0
  score += buildTeacherHistoryScore(histories, teacher.id, classItem.id, course.id, 'course')
  if (teacher.primaryCourseIds.includes(course.id)) score += 35
  if (teacher.courseIds.includes(course.id)) score += 18
  if (teacher.mainSubject === course.name) score += 15
  if (course.isMainCourse && teacher.canTeachMainCourse) score += 20
  if (teacher.canCrossClass) score += 8
  if (teacher.canCrossGrade) score += 5
  if (!course.allowCrossClass && !teacher.canCrossClass) score += 8

  return score
}

const buildHeadTeacherCandidateScore = (
  teacher: TeacherScheduleTeacherType,
  histories: TeacherScheduleTeachingHistoryType[],
  classItem: TeacherScheduleClassType,
  constraints: TeacherScheduleTeacherConstraintType[]
): number | null => {
  if (!isTeacherActive(teacher.status)) return null
  if (!teacher.canBeHeadTeacher) return null
  if (hasConstraintValue(constraints, teacher.id, classItem.termId, 'cannot-head-teacher')) {
    return null
  }
  if (hasConstraintValue(constraints, teacher.id, classItem.termId, 'cannot-teach-role', 'head-teacher')) {
    return null
  }

  let score = 0
  score += buildTeacherHistoryScore(histories, teacher.id, classItem.id, null, 'head-teacher')
  if (teacher.mainSubject === '语文' || teacher.mainSubject === '数学') score += 18
  if (teacher.canTeachMainCourse) score += 10
  if (teacher.canCrossClass) score += 5

  return score
}

export const useTeacherScheduleStore = defineStore('teacherSchedule', {
  state: (): TeacherScheduleStateType => createDefaultTeacherScheduleState(),
  getters: {
    activeTerm(state): TeacherScheduleTermType | undefined {
      return state.terms.find((term) => term.id === state.currentTermId) ?? state.terms[0]
    },
    activePlan(state): TeacherSchedulePlanType | undefined {
      return state.plans.find((plan) => plan.id === state.selectedPlanId) ?? state.plans[0]
    },
    activeClasses(state): TeacherScheduleClassType[] {
      return state.classes.filter((item) => item.termId === state.currentTermId)
    },
    activeGradeTemplates(state): TeacherScheduleGradeCourseTemplateType[] {
      return state.gradeTemplates.filter((item) => item.termId === state.currentTermId)
    },
    activeTeacherConstraints(state): TeacherScheduleTeacherConstraintType[] {
      return state.teacherConstraints.filter((item) => item.termId === state.currentTermId)
    },
    activeTeachingHistories(state): TeacherScheduleTeachingHistoryType[] {
      return state.teachingHistories.filter((item) => item.termId === state.currentTermId)
    },
    activeAssignments(state): TeacherScheduleAssignmentType[] {
      const activePlanId = state.selectedPlanId || state.plans[0]?.id || ''
      return activePlanId
        ? state.assignments.filter((item) => item.planId === activePlanId)
        : []
    },
    activeConflicts(state): TeacherScheduleConflictTypeRecord[] {
      const activePlanId = state.selectedPlanId || state.plans[0]?.id || ''
      return activePlanId
        ? state.conflicts.filter((item) => item.planId === activePlanId)
        : []
    }
  },
  actions: {
    ensureDefaultTerm(): void {
      if (this.terms.length > 0) return
      const state = createDefaultTeacherScheduleState()
      this.currentTermId = state.currentTermId
      this.terms = state.terms
    },
    setCurrentTerm(termId: string): void {
      this.currentTermId = termId
    },
    setSelectedPlan(planId: string): void {
      this.selectedPlanId = planId
    },
    saveTerm(term: Partial<TeacherScheduleTermType> & { id?: string }): TeacherScheduleTermType {
      const id = term.id || createId('term')
      const academicYear = term.academicYear || this.activeTerm?.academicYear || ''
      const semester = term.semester || this.activeTerm?.semester || 'year'
      const nextTerm: TeacherScheduleTermType = {
        id,
        academicYear,
        semester,
        name: term.name || getTermLabel(academicYear, semester),
        startDate: term.startDate || '',
        endDate: term.endDate || '',
        status: term.status || 'active',
        remark: term.remark || ''
      }
      upsertRecord(this.terms, nextTerm)
      if (!this.currentTermId) {
        this.currentTermId = nextTerm.id
      }
      return nextTerm
    },
    removeTerm(id: string): void {
      const removedPlanIds = this.plans.filter((item) => item.termId === id).map((item) => item.id)
      removeRecord(this.terms, id)
      this.classes = this.classes.filter((item) => item.termId !== id)
      this.gradeTemplates = this.gradeTemplates.filter((item) => item.termId !== id)
      this.teacherConstraints = this.teacherConstraints.filter((item) => item.termId !== id)
      this.teachingHistories = this.teachingHistories.filter((item) => item.termId !== id)
      this.plans = this.plans.filter((item) => item.termId !== id)
      this.assignments = this.assignments.filter((item) => !removedPlanIds.includes(item.planId))
      this.conflicts = this.conflicts.filter((item) => !removedPlanIds.includes(item.planId))
      if (this.currentTermId === id) {
        this.currentTermId = this.terms[0]?.id || ''
      }
      if (removedPlanIds.includes(this.selectedPlanId)) {
        this.selectedPlanId = this.plans[0]?.id || ''
      }
    },
    saveCourse(course: Partial<TeacherScheduleCourseType> & { id?: string }): TeacherScheduleCourseType {
      const nextCourse: TeacherScheduleCourseType = {
        id: course.id || createId('course'),
        name: course.name || '',
        shortName: course.shortName || course.name || '',
        category: course.category || 'other',
        isMainCourse: course.isMainCourse ?? false,
        allowCrossClass: course.allowCrossClass ?? true,
        allowCrossGrade: course.allowCrossGrade ?? true,
        status: course.status || 'active',
        remark: course.remark || ''
      }
      upsertRecord(this.courses, nextCourse)
      return nextCourse
    },
    removeCourse(id: string): void {
      removeRecord(this.courses, id)
      this.gradeTemplates = this.gradeTemplates.filter((item) => item.courseId !== id)
      this.teachingHistories = this.teachingHistories.filter((item) => item.courseId !== id)
      this.assignments = this.assignments.filter((item) => item.courseId !== id)
    },
    saveGradeTemplate(
      template: Partial<TeacherScheduleGradeCourseTemplateType> & { id?: string }
    ): TeacherScheduleGradeCourseTemplateType {
      const nextTemplate: TeacherScheduleGradeCourseTemplateType = {
        id: template.id || createId('template'),
        termId: template.termId || this.currentTermId,
        grade: template.grade || '',
        courseId: template.courseId || '',
        weeklyHours: Number(template.weeklyHours || 0),
        required: template.required ?? true,
        sortOrder: Number(template.sortOrder || 0),
        termScope: template.termScope || 'year',
        remark: template.remark || ''
      }
      upsertRecord(this.gradeTemplates, nextTemplate)
      return nextTemplate
    },
    removeGradeTemplate(id: string): void {
      removeRecord(this.gradeTemplates, id)
    },
    saveClass(classItem: Partial<TeacherScheduleClassType> & { id?: string }): TeacherScheduleClassType {
      const nextClass: TeacherScheduleClassType = {
        id: classItem.id || createId('class'),
        termId: classItem.termId || this.currentTermId,
        grade: classItem.grade || '',
        classNo: classItem.classNo || '',
        name: classItem.name || '',
        studentCount: Number(classItem.studentCount || 0),
        headTeacherId: classItem.headTeacherId ?? null,
        status: classItem.status || 'active',
        remark: classItem.remark || ''
      }
      upsertRecord(this.classes, nextClass)
      return nextClass
    },
    removeClass(id: string): void {
      removeRecord(this.classes, id)
      this.teachingHistories = this.teachingHistories.filter((item) => item.classId !== id)
      this.assignments = this.assignments.filter((item) => item.classId !== id)
    },
    saveTeacher(
      teacher: Partial<TeacherScheduleTeacherType> & { id?: string }
    ): TeacherScheduleTeacherType {
      const nextTeacher: TeacherScheduleTeacherType = {
        id: teacher.id || createId('teacher'),
        name: teacher.name || '',
        status: teacher.status || 'on-duty',
        mainSubject: teacher.mainSubject || '',
        courseIds: teacher.courseIds || [],
        primaryCourseIds: teacher.primaryCourseIds || [],
        canBeHeadTeacher: teacher.canBeHeadTeacher ?? true,
        canTeachMainCourse: teacher.canTeachMainCourse ?? true,
        canCrossClass: teacher.canCrossClass ?? false,
        canCrossGrade: teacher.canCrossGrade ?? false,
        maxWeeklyHours: Number(teacher.maxWeeklyHours || 24),
        specialNote: teacher.specialNote || '',
        remark: teacher.remark || ''
      }
      upsertRecord(this.teachers, nextTeacher)
      return nextTeacher
    },
    removeTeacher(id: string): void {
      removeRecord(this.teachers, id)
      this.teacherConstraints = this.teacherConstraints.filter((item) => item.teacherId !== id)
      this.teachingHistories = this.teachingHistories.filter((item) => item.teacherId !== id)
      this.assignments = this.assignments.filter((item) => item.teacherId !== id)
      this.classes = this.classes.map((item) =>
        item.headTeacherId === id ? { ...item, headTeacherId: null } : item
      )
    },
    saveTeacherConstraint(
      constraint: Partial<TeacherScheduleTeacherConstraintType> & { id?: string }
    ): TeacherScheduleTeacherConstraintType {
      const nextConstraint: TeacherScheduleTeacherConstraintType = {
        id: constraint.id || createId('constraint'),
        teacherId: constraint.teacherId || '',
        termId: constraint.termId || this.currentTermId,
        constraintType: constraint.constraintType || 'cannot-main-course',
        constraintValue: constraint.constraintValue || '',
        scope: constraint.scope || 'hard',
        priority: Number(constraint.priority || 0),
        remark: constraint.remark || ''
      }
      upsertRecord(this.teacherConstraints, nextConstraint)
      return nextConstraint
    },
    removeTeacherConstraint(id: string): void {
      removeRecord(this.teacherConstraints, id)
    },
    saveTeachingHistory(
      history: Partial<TeacherScheduleTeachingHistoryType> & { id?: string }
    ): TeacherScheduleTeachingHistoryType {
      const nextHistory: TeacherScheduleTeachingHistoryType = {
        id: history.id || createId('history'),
        termId: history.termId || this.currentTermId,
        teacherId: history.teacherId || '',
        classId: history.classId || '',
        courseId: history.courseId ?? null,
        role: history.role || 'course',
        isMainCourse: history.isMainCourse ?? false,
        source: history.source || 'manual',
        remark: history.remark || ''
      }
      upsertRecord(this.teachingHistories, nextHistory)
      return nextHistory
    },
    removeTeachingHistory(id: string): void {
      removeRecord(this.teachingHistories, id)
    },
    savePlan(plan: Partial<TeacherSchedulePlanType> & { id?: string }): TeacherSchedulePlanType {
      const now = new Date().toISOString()
      const nextPlan: TeacherSchedulePlanType = {
        id: plan.id || createId('plan'),
        termId: plan.termId || this.currentTermId,
        name: plan.name || `排课草案-${now.slice(0, 10)}`,
        status: isPlanStatus(plan.status || 'draft') ? (plan.status || 'draft') : 'draft',
        basePlanId: plan.basePlanId ?? null,
        aiGenerated: plan.aiGenerated ?? false,
        score: Number(plan.score || 0),
        generatedAt: plan.generatedAt || now,
        createdAt: plan.createdAt || now,
        updatedAt: now,
        summary: plan.summary || ''
      }
      upsertRecord(this.plans, nextPlan)
      this.selectedPlanId = nextPlan.id
      return nextPlan
    },
    removePlan(id: string): void {
      removeRecord(this.plans, id)
      this.assignments = this.assignments.filter((item) => item.planId !== id)
      this.conflicts = this.conflicts.filter((item) => item.planId !== id)
      if (this.selectedPlanId === id) {
        this.selectedPlanId = this.plans[0]?.id || ''
      }
    },
    saveAssignment(
      assignment: Partial<TeacherScheduleAssignmentType> & { id?: string }
    ): TeacherScheduleAssignmentType {
      const nextAssignment: TeacherScheduleAssignmentType = {
        id: assignment.id || createId('assignment'),
        planId: assignment.planId || this.selectedPlanId || this.plans[0]?.id || '',
        classId: assignment.classId || '',
        courseId: assignment.courseId ?? null,
        teacherId: assignment.teacherId || '',
        role: assignment.role || 'course',
        weeklyHours: Number(assignment.weeklyHours || 0),
        locked: assignment.locked ?? false,
        source: assignment.source || 'manual',
        confidence: Number(assignment.confidence || 0),
        remark: assignment.remark || ''
      }
      upsertRecord(this.assignments, nextAssignment)
      return nextAssignment
    },
    removeAssignment(id: string): void {
      removeRecord(this.assignments, id)
    },
    saveConflict(
      conflict: Partial<TeacherScheduleConflictTypeRecord> & { id?: string }
    ): TeacherScheduleConflictTypeRecord {
      const nextConflict: TeacherScheduleConflictTypeRecord = {
        id: conflict.id || createId('conflict'),
        planId: conflict.planId || this.selectedPlanId || '',
        conflictType: conflict.conflictType || 'invalid-assignment',
        severity: conflict.severity || 'medium',
        targetType: conflict.targetType || 'plan',
        targetId: conflict.targetId || '',
        message: conflict.message || '',
        resolved: conflict.resolved ?? false,
        resolvedBy: conflict.resolvedBy || '',
        resolvedAt: conflict.resolvedAt || ''
      }
      upsertRecord(this.conflicts, nextConflict)
      return nextConflict
    },
    removeConflict(id: string): void {
      removeRecord(this.conflicts, id)
    },
    markConflictResolved(id: string, resolvedBy = 'manual'): void {
      const conflict = this.conflicts.find((item) => item.id === id)
      if (!conflict) return
      conflict.resolved = true
      conflict.resolvedBy = resolvedBy
      conflict.resolvedAt = new Date().toISOString()
    },
    resetPlanDiagnostics(planId: string): void {
      this.conflicts = this.conflicts.filter((item) => item.planId !== planId)
      this.assignments = this.assignments.filter((item) => item.planId !== planId)
    },
    generateDraftPlan(options?: { name?: string; basePlanId?: string | null }): TeacherSchedulePlanType {
      const term = this.activeTerm || this.terms[0]
      const plan = this.savePlan({
        termId: term.id,
        name: options?.name || `${term.name} 排课草案`,
        basePlanId: options?.basePlanId ?? this.activePlan?.id ?? null,
        aiGenerated: false,
        status: 'draft'
      })

      const activeClasses = this.activeClasses
      const activeTemplates = this.activeGradeTemplates
      const activeCourses = new Map(this.courses.map((item) => [item.id, item]))
      const activeTeachers = this.teachers.filter((teacher) => isTeacherActive(teacher.status))
      const activeHistories = this.teachingHistories.filter((item) => item.termId === term.id)
      const activeConstraints = this.teacherConstraints.filter((item) => item.termId === term.id)
      const classLookup = new Map(activeClasses.map((item) => [item.id, item]))
      const teacherLoad = getTeacherLoad(this.assignments.filter((item) => item.planId === plan.id))
      const nextAssignments: TeacherScheduleAssignmentType[] = []
      const nextConflicts: TeacherScheduleConflictTypeRecord[] = []

      this.resetPlanDiagnostics(plan.id)

      for (const classItem of activeClasses) {
        if (classItem.headTeacherId) {
          const teacher = this.teachers.find((item) => item.id === classItem.headTeacherId)
          if (!teacher) {
            nextConflicts.push(
              buildConflict(
                plan.id,
                'missing-head-teacher',
                'high',
                'class',
                classItem.id,
                `${classItem.name} 已配置的班主任不存在`
              )
            )
          } else if (!teacher.canBeHeadTeacher || teacher.status !== 'on-duty') {
            nextConflicts.push(
              buildConflict(
                plan.id,
                'constraint-violation',
                'high',
                'teacher',
                teacher.id,
                `${teacher.name} 当前不适合担任 ${classItem.name} 的班主任`
              )
            )
          } else {
            nextAssignments.push({
              id: createId('assignment'),
              planId: plan.id,
              classId: classItem.id,
              courseId: null,
              teacherId: teacher.id,
              role: 'head-teacher',
              weeklyHours: 0,
              locked: true,
              source: 'history',
              confidence: 100,
              remark: '沿用班级班主任'
            })
          }
        } else {
          const candidate = activeTeachers
            .map((teacher) => ({
              teacher,
              score: buildHeadTeacherCandidateScore(teacher, activeHistories, classItem, activeConstraints)
            }))
            .filter((item): item is { teacher: TeacherScheduleTeacherType; score: number } =>
              typeof item.score === 'number'
            )
            .sort((a, b) => b.score - a.score)[0]

          if (!candidate) {
            nextConflicts.push(
              buildConflict(
                plan.id,
                'no-candidate',
                'medium',
                'class',
                classItem.id,
                `${classItem.name} 暂时没有可用的班主任候选人`
              )
            )
          } else {
            nextAssignments.push({
              id: createId('assignment'),
              planId: plan.id,
              classId: classItem.id,
              courseId: null,
              teacherId: candidate.teacher.id,
              role: 'head-teacher',
              weeklyHours: 0,
              locked: false,
              source: 'rule',
              confidence: Math.min(100, candidate.score),
              remark: '系统推荐班主任'
            })
          }
        }

        const classTemplates = activeTemplates
          .filter((item) => item.grade === classItem.grade && item.termId === term.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)

        for (const template of classTemplates) {
          const course = activeCourses.get(template.courseId)
          if (!course) {
            nextConflicts.push(
              buildConflict(
                plan.id,
                'missing-course',
                'high',
                'course',
                template.courseId,
                `${classItem.name} 的课程模板引用了不存在的课程`
              )
            )
            continue
          }

          const candidate = activeTeachers
            .map((teacher) => ({
              teacher,
              score: buildCourseCandidateScore(
                teacher,
                course,
                template,
                activeHistories,
                classItem,
                teacherLoad,
                activeConstraints,
                nextAssignments,
                classLookup
              )
            }))
            .filter((item): item is { teacher: TeacherScheduleTeacherType; score: number } =>
              typeof item.score === 'number'
            )
            .sort((a, b) => b.score - a.score)[0]

          if (!candidate) {
            nextConflicts.push(
              buildConflict(
                plan.id,
                'no-candidate',
                template.required ? 'high' : 'medium',
                'assignment',
                template.id,
                `${classItem.name} 的 ${course.name} 暂时没有可用教师`
              )
            )
            continue
          }

          const nextHours = template.weeklyHours
          teacherLoad[candidate.teacher.id] = (teacherLoad[candidate.teacher.id] || 0) + nextHours
          nextAssignments.push({
            id: createId('assignment'),
            planId: plan.id,
            classId: classItem.id,
            courseId: course.id,
            teacherId: candidate.teacher.id,
            role: 'course',
            weeklyHours: nextHours,
            locked: false,
            source: 'rule',
            confidence: Math.min(100, candidate.score),
            remark: template.required ? '必排课程推荐' : '选排课程推荐'
          })

          const historyMatched = activeHistories.some(
            (history) =>
              history.classId === classItem.id &&
              history.courseId === course.id &&
              history.teacherId === candidate.teacher.id
          )
          if (!historyMatched) {
            nextConflicts.push(
              buildConflict(
                plan.id,
                'history-not-inherited',
                'low',
                'assignment',
                template.id,
                `${classItem.name} 的 ${course.name} 沿用了新的推荐教师，未完全继承历史安排`
              )
            )
          }
        }
      }

      const overflowTeachers = activeTeachers.filter((teacher) => {
        const load = teacherLoad[teacher.id] || 0
        return load > teacher.maxWeeklyHours
      })

      for (const teacher of overflowTeachers) {
        nextConflicts.push(
          buildConflict(
            plan.id,
            'hours-overflow',
            'high',
            'teacher',
            teacher.id,
            `${teacher.name} 的预估课时超过上限`
          )
        )
      }

      this.assignments = this.assignments.filter((item) => item.planId !== plan.id).concat(nextAssignments)
      this.conflicts = this.conflicts.filter((item) => item.planId !== plan.id).concat(nextConflicts)

      const nextScore = Math.max(0, 100 - nextConflicts.filter((item) => item.severity === 'high').length * 12 - nextConflicts.filter((item) => item.severity === 'medium').length * 5)
      const currentPlan = this.plans.find((item) => item.id === plan.id)
      if (currentPlan) {
        currentPlan.score = nextScore
        currentPlan.summary = createPlanSummary(nextAssignments, nextConflicts)
        currentPlan.updatedAt = new Date().toISOString()
      }

      this.selectedPlanId = plan.id
      return plan
    },
    exportState(): TeacherScheduleStateType {
      return clone(this.$state)
    }
  }
})
