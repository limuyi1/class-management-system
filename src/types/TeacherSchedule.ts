export type TeacherScheduleTermStatusType = 'active' | 'archived'
export type TeacherScheduleSemesterType = 'autumn' | 'spring' | 'year'
export type TeacherScheduleCourseCategoryType =
  | 'main-course'
  | 'specialty'
  | 'class-meeting'
  | 'school-based'
  | 'other'
export type TeacherScheduleCourseStatusType = 'active' | 'paused' | 'archived'
export type TeacherScheduleTeacherStatusType = 'on-duty' | 'left' | 'transferred' | 'paused'
export type TeacherScheduleConstraintType =
  | 'cannot-main-course'
  | 'cannot-head-teacher'
  | 'cannot-cross-class'
  | 'cannot-cross-grade'
  | 'cannot-teach-course'
  | 'cannot-teach-grade'
  | 'cannot-teach-role'
  | 'avoid-time-slot'
export type TeacherScheduleConstraintScopeType = 'hard' | 'soft'
export type TeacherSchedulePlanStatusType = 'draft' | 'confirmed' | 'published' | 'archived'
export type TeacherScheduleAssignmentRoleType = 'course' | 'head-teacher'
export type TeacherScheduleAssignmentSourceType = 'history' | 'manual' | 'ai' | 'rule'
export type TeacherScheduleConflictSeverityType = 'high' | 'medium' | 'low'
export type TeacherScheduleConflictType =
  | 'no-candidate'
  | 'missing-course'
  | 'missing-head-teacher'
  | 'constraint-violation'
  | 'hours-overflow'
  | 'history-not-inherited'
  | 'invalid-assignment'

export interface TeacherScheduleTermType {
  id: string
  academicYear: string
  semester: TeacherScheduleSemesterType
  name: string
  startDate: string
  endDate: string
  status: TeacherScheduleTermStatusType
  remark: string
}

export interface TeacherScheduleCourseType {
  id: string
  name: string
  shortName: string
  category: TeacherScheduleCourseCategoryType
  isMainCourse: boolean
  allowCrossClass: boolean
  allowCrossGrade: boolean
  status: TeacherScheduleCourseStatusType
  remark: string
}

export interface TeacherScheduleGradeCourseTemplateType {
  id: string
  termId: string
  grade: string
  courseId: string
  weeklyHours: number
  required: boolean
  sortOrder: number
  termScope: TeacherScheduleSemesterType
  remark: string
}

export interface TeacherScheduleClassType {
  id: string
  termId: string
  grade: string
  classNo: string
  name: string
  studentCount: number
  headTeacherId: string | null
  status: 'active' | 'paused' | 'archived'
  remark: string
}

export interface TeacherScheduleTeacherType {
  id: string
  name: string
  status: TeacherScheduleTeacherStatusType
  mainSubject: string
  courseIds: string[]
  primaryCourseIds: string[]
  canBeHeadTeacher: boolean
  canTeachMainCourse: boolean
  canCrossClass: boolean
  canCrossGrade: boolean
  maxWeeklyHours: number
  specialNote: string
  remark: string
}

export interface TeacherScheduleTeacherConstraintType {
  id: string
  teacherId: string
  termId: string
  constraintType: TeacherScheduleConstraintType
  constraintValue: string
  scope: TeacherScheduleConstraintScopeType
  priority: number
  remark: string
}

export interface TeacherScheduleTeachingHistoryType {
  id: string
  termId: string
  teacherId: string
  classId: string
  courseId: string | null
  role: TeacherScheduleAssignmentRoleType
  isMainCourse: boolean
  source: 'last-year' | 'last-semester' | 'manual'
  remark: string
}

export interface TeacherSchedulePlanType {
  id: string
  termId: string
  name: string
  status: TeacherSchedulePlanStatusType
  basePlanId: string | null
  aiGenerated: boolean
  score: number
  generatedAt: string
  createdAt: string
  updatedAt: string
  summary: string
}

export interface TeacherScheduleAssignmentType {
  id: string
  planId: string
  classId: string
  courseId: string | null
  teacherId: string
  role: TeacherScheduleAssignmentRoleType
  weeklyHours: number
  locked: boolean
  source: TeacherScheduleAssignmentSourceType
  confidence: number
  remark: string
}

export interface TeacherScheduleConflictTypeRecord {
  id: string
  planId: string
  conflictType: TeacherScheduleConflictType
  severity: TeacherScheduleConflictSeverityType
  targetType: 'term' | 'class' | 'course' | 'teacher' | 'assignment' | 'plan'
  targetId: string
  message: string
  resolved: boolean
  resolvedBy: string
  resolvedAt: string
}

export interface TeacherScheduleStateType {
  currentTermId: string
  selectedPlanId: string
  terms: TeacherScheduleTermType[]
  courses: TeacherScheduleCourseType[]
  gradeTemplates: TeacherScheduleGradeCourseTemplateType[]
  classes: TeacherScheduleClassType[]
  teachers: TeacherScheduleTeacherType[]
  teacherConstraints: TeacherScheduleTeacherConstraintType[]
  teachingHistories: TeacherScheduleTeachingHistoryType[]
  plans: TeacherSchedulePlanType[]
  assignments: TeacherScheduleAssignmentType[]
  conflicts: TeacherScheduleConflictTypeRecord[]
}

