import { listEnrollments } from '../repositories/workspaces.js'
import { BusinessError } from './errors.js'
import type { DatabaseType } from '../types/Account.js'
import type {
  ClassroomToolContentType,
  ClassroomToolKindType
} from '../../../packages/shared/src/ClassroomTools.js'

const invalid = (message: string): never => {
  throw new BusinessError(400, 'INVALID_TOOL', message)
}
/** 除 JSON 白名单外再检查关系完整性；系统名单只能引用本账号、本学期有效学生。 */
export function validateClassroomTool(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string,
  kind: ClassroomToolKindType,
  content: ClassroomToolContentType
): void {
  if (!content.name.trim()) invalid('方案名称不能为空')
  const unique = (ids: string[], label: string): Set<string> => {
    if (new Set(ids).size !== ids.length) invalid(`${label}不能重复`)
    return new Set(ids)
  }
  let students: Set<string>
  if (content.studentSource === 'excel') {
    if (
      !content.excelSource ||
      content.excelSource.students.some((student) => !student.name.trim())
    )
      invalid('请提供有效临时名单')
    students = unique(
      content.excelSource!.students.map((student) => student.id),
      '临时学生 ID'
    )
  } else {
    if (content.excelSource) invalid('系统名单方案不能夹带临时名单')
    students = new Set(
      listEnrollments(database, ownerId, workspaceId)
        .filter((student) => !student.disabled && !student.departed)
        .map((student) => student.studentId)
    )
  }
  const checkStudent = (id: string | null | undefined): void => {
    if (id && !students.has(id)) invalid('安排包含其他账号、其他学期或已停用的学生')
  }
  if (kind === 'seating') {
    if (!('seats' in content)) invalid('方案类型与内容不匹配')
    const chart = content as Extract<ClassroomToolContentType, { seats: unknown }>
    if (chart.seats.length !== chart.rows * chart.columns) invalid('座位网格不完整')
    unique(
      chart.seats.map((seat) => `${seat.row}:${seat.column}`),
      '座位坐标'
    )
    for (const seat of chart.seats) {
      if (seat.row >= chart.rows || seat.column >= chart.columns) invalid('座位坐标超出布局')
      checkStudent(seat.studentId)
    }
    unique(chart.aisleAfterColumns.map(String), '过道')
    if (chart.aisleAfterColumns.some((column) => column >= chart.columns - 1))
      invalid('过道超出布局')
    unique(
      chart.specialSeats.map((seat) => seat.position),
      '特殊座位'
    )
    chart.specialSeats.forEach((seat) => {
      if (!seat.enabled && seat.studentId) invalid('禁用特殊座位不能安排学生')
      checkStudent(seat.studentId)
    })
    unique(
      [...chart.seats, ...chart.specialSeats].flatMap((seat) =>
        seat.studentId ? [seat.studentId] : []
      ),
      '已安排学生'
    )
    const roles = unique(
      chart.roleDefinitions.map((role) => role.id),
      '职务 ID'
    )
    unique(
      chart.roleAssignments.map((row) => row.studentId),
      '学生职务记录'
    )
    chart.roleAssignments.forEach((row) => {
      checkStudent(row.studentId)
      unique(row.roleIds, '学生职务')
      if (row.roleIds.some((id) => !roles.has(id))) invalid('学生职务引用不存在')
    })
    unique(chart.rotationFixedStudentIds || [], '固定学生')
    chart.rotationFixedStudentIds?.forEach(checkStudent)
  } else {
    if (!('sections' in content)) invalid('方案类型与内容不匹配')
    const roster = content as Extract<ClassroomToolContentType, { sections: unknown }>
    const sections = unique(
      roster.sections.map((section) => section.id),
      '区域 ID'
    )
    const positions = unique(
      roster.sections.flatMap((section) => section.positions.map((position) => position.id)),
      '岗位 ID'
    )
    const rows = unique(
      roster.weeklyRows.map((row) => row.id),
      '周表行 ID'
    )
    roster.sections.forEach((section) => checkStudent(section.leaderStudentId))
    const checkPeriod = (period: string, rowId?: string): void => {
      if (
        roster.mode === 'weekly'
          ? period !== 'weekly' || !rowId || !rows.has(rowId)
          : period === 'weekly' || Boolean(rowId)
      )
        invalid('值日周期与模式不匹配')
    }
    unique(
      roster.assignments.map((row) => `${row.period}:${row.rowId || ''}:${row.positionId}`),
      '值日格'
    )
    roster.assignments.forEach((row) => {
      checkPeriod(row.period, row.rowId)
      if (!positions.has(row.positionId)) invalid('值日岗位不存在')
      unique(row.studentIds, '值日格学生')
      row.studentIds.forEach(checkStudent)
    })
    unique(
      roster.leaders.map(
        (row) => `${row.period}:${row.rowId || ''}:${row.sectionId}:${row.studentId}`
      ),
      '区域组长'
    )
    roster.leaders.forEach((row) => {
      checkPeriod(row.period, row.rowId)
      if (!sections.has(row.sectionId)) invalid('组长区域不存在')
      checkStudent(row.studentId)
      const section = roster.sections.find((section) => section.id === row.sectionId)!
      if (
        !roster.assignments.some(
          (assignment) =>
            assignment.period === row.period &&
            assignment.rowId === row.rowId &&
            assignment.studentIds.includes(row.studentId) &&
            section.positions.some((position) => position.id === assignment.positionId)
        )
      )
        invalid('时段组长必须已安排到对应区域')
    })
    Object.keys(roster.studentCardCounts || {}).forEach(checkStudent)
    const assignedCounts = new Map<string, number>()
    for (const assignment of roster.assignments)
      for (const id of assignment.studentIds)
        assignedCounts.set(id, (assignedCounts.get(id) || 0) + 1)
    const cardCounts = [...students].map((id) =>
      Math.max(1, assignedCounts.get(id) || 0, roster.studentCardCounts?.[id] || 0)
    )
    if (
      cardCounts.some((count) => count > 100) ||
      cardCounts.reduce((sum, count) => sum + count, 0) > 5000
    )
      invalid('每名学生卡片不能超过 100，总数不能超过 5000')
    const periods =
      roster.mode === 'weekly'
        ? ['weekly']
        : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    const slotRows = roster.mode === 'weekly' ? [...rows] : ['']
    const slots = new Set(
      periods.flatMap((period) =>
        slotRows.flatMap((row) => [...positions].map((position) => `${period}:${row}:${position}`))
      )
    )
    if (Object.keys(roster.autoAssignCapacities || {}).some((key) => !slots.has(key)))
      invalid('自动分配容量引用不存在的岗位格')
  }
}
