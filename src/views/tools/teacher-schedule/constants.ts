import type {
  TeacherScheduleAssignmentRoleType,
  TeacherScheduleConflictSeverityType,
  TeacherScheduleConstraintScopeType,
  TeacherScheduleConstraintType,
  TeacherScheduleCourseCategoryType,
  TeacherScheduleCourseStatusType,
  TeacherSchedulePlanStatusType,
  TeacherScheduleSemesterType,
  TeacherScheduleStateType,
  TeacherScheduleTeacherStatusType,
  TeacherScheduleTermStatusType
} from '@/types/TeacherSchedule'

export interface TeacherScheduleOptionType<T extends string> {
  label: string
  value: T
}

export const semesterOptions: TeacherScheduleOptionType<TeacherScheduleSemesterType>[] = [
  { label: '上学期', value: 'spring' },
  { label: '下学期', value: 'autumn' },
  { label: '整学年', value: 'year' }
]

export const termStatusOptions: TeacherScheduleOptionType<TeacherScheduleTermStatusType>[] = [
  { label: '启用', value: 'active' },
  { label: '归档', value: 'archived' }
]

export const courseCategoryOptions: TeacherScheduleOptionType<TeacherScheduleCourseCategoryType>[] =
  [
    { label: '主课', value: 'main-course' },
    { label: '副科', value: 'specialty' },
    { label: '班会', value: 'class-meeting' },
    { label: '校本', value: 'school-based' },
    { label: '其他', value: 'other' }
  ]

export const courseStatusOptions: TeacherScheduleOptionType<TeacherScheduleCourseStatusType>[] = [
  { label: '启用', value: 'active' },
  { label: '暂停', value: 'paused' },
  { label: '归档', value: 'archived' }
]

export const teacherStatusOptions: TeacherScheduleOptionType<TeacherScheduleTeacherStatusType>[] = [
  { label: '在职', value: 'on-duty' },
  { label: '离职', value: 'left' },
  { label: '调走', value: 'transferred' },
  { label: '停用', value: 'paused' }
]

export const planStatusOptions: TeacherScheduleOptionType<TeacherSchedulePlanStatusType>[] = [
  { label: '草案', value: 'draft' },
  { label: '确认', value: 'confirmed' },
  { label: '发布', value: 'published' },
  { label: '归档', value: 'archived' }
]

export const constraintTypeOptions: TeacherScheduleOptionType<TeacherScheduleConstraintType>[] = [
  { label: '不能任主课', value: 'cannot-main-course' },
  { label: '不能任班主任', value: 'cannot-head-teacher' },
  { label: '不能跨班', value: 'cannot-cross-class' },
  { label: '不能跨年级', value: 'cannot-cross-grade' },
  { label: '不能教某课程', value: 'cannot-teach-course' },
  { label: '不能教某年级', value: 'cannot-teach-grade' },
  { label: '不能担任某角色', value: 'cannot-teach-role' },
  { label: '避开某时段', value: 'avoid-time-slot' }
]

export const constraintScopeOptions: TeacherScheduleOptionType<TeacherScheduleConstraintScopeType>[] =
  [
    { label: '硬约束', value: 'hard' },
    { label: '软约束', value: 'soft' }
  ]

export const assignmentRoleOptions: TeacherScheduleOptionType<TeacherScheduleAssignmentRoleType>[] = [
  { label: '任课', value: 'course' },
  { label: '班主任', value: 'head-teacher' }
]

export const conflictSeverityOptions: TeacherScheduleOptionType<TeacherScheduleConflictSeverityType>[] =
  [
    { label: '高', value: 'high' },
    { label: '中', value: 'medium' },
    { label: '低', value: 'low' }
  ]

const now = new Date()
const currentAcademicYear =
  now.getMonth() >= 8
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`

const currentSemester: TeacherScheduleSemesterType = now.getMonth() >= 8 ? 'autumn' : 'spring'

export const createId = (prefix: string): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const getTermLabel = (academicYear: string, semester: TeacherScheduleSemesterType): string => {
  if (semester === 'year') return `${academicYear} 全学年`
  return `${academicYear} ${semester === 'autumn' ? '下学期' : '上学期'}`
}

export const createDefaultTeacherScheduleState = (): TeacherScheduleStateType => {
  const defaultTermId = createId('term')
  return {
    currentTermId: defaultTermId,
    selectedPlanId: '',
    terms: [
      {
        id: defaultTermId,
        academicYear: currentAcademicYear,
        semester: currentSemester,
        name: getTermLabel(currentAcademicYear, currentSemester),
        startDate: '',
        endDate: '',
        status: 'active',
        remark: '首次进入排课工具时自动生成的默认学期'
      }
    ],
    courses: [],
    gradeTemplates: [],
    classes: [],
    teachers: [],
    teacherConstraints: [],
    teachingHistories: [],
    plans: [],
    assignments: [],
    conflicts: []
  }
}
