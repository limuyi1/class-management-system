/**
 * 座位表核心工具
 * 提供座位生成、尺寸调整、数据规范化、随机排座与展示顺序等底层操作
 */
import {
  SeatingSpecialSeatPositionEnum,
  SeatingFirstColumnSideEnum,
  type SeatingRoleAssignmentType,
  type SeatingRoleDefinitionType,
  type SeatPositionType,
  type SeatingChartType,
  type SeatingSpecialSeatType
} from '@/types/SeatingChart'

/** 座位表行列数下限 */
export const SEATING_CHART_MIN_SIZE = 1
/** 座位表行列数上限 */
export const SEATING_CHART_MAX_SIZE = 20

/** 默认职务配色：同科目使用同一色系，不同职务保持可辨识差异 */
const DEFAULT_ROLE_PRESETS = [
  ['语文', '组长', '语组', '#D94B4B'],
  ['语文', '副组长', '语副', '#E77B73'],
  ['语文', '课代表', '语课', '#B83F64'],
  ['数学', '组长', '数组', '#3978D4'],
  ['数学', '副组长', '数副', '#6F9FE3'],
  ['数学', '课代表', '数课', '#5965C8'],
  ['英语', '组长', '英组', '#228B62'],
  ['英语', '副组长', '英副', '#5BAA82'],
  ['英语', '课代表', '英课', '#247F82']
] as const

/** 创建语数外组长、副组长与课代表的默认职务集合 */
export function createDefaultSeatingRoles(): SeatingRoleDefinitionType[] {
  return DEFAULT_ROLE_PRESETS.map(([subject, title, shortLabel, color], index) => ({
    id: `seating-role-${subject}-${title}`,
    subject,
    title,
    groupName: '',
    shortLabel,
    color,
    sortOrder: index
  }))
}

/** 规范化座位表职务定义，旧数据缺失时补齐默认职务 */
function normalizeRoleDefinitions(chart: SeatingChartType): SeatingRoleDefinitionType[] {
  if (!Array.isArray(chart.roleDefinitions)) return createDefaultSeatingRoles()
  const seen = new Set<string>()
  return chart.roleDefinitions.flatMap((role, index) => {
    if (!role?.id || seen.has(role.id)) return []
    seen.add(role.id)
    return [
      {
        id: role.id,
        subject: String(role.subject || '').trim(),
        title: String(role.title || '').trim(),
        groupName: String(role.groupName || '').trim(),
        shortLabel: String(role.shortLabel || '').trim() || String(role.title || '职务'),
        color: /^#[0-9a-f]{6}$/i.test(role.color) ? role.color : '#8060AA',
        sortOrder: Number.isFinite(role.sortOrder) ? role.sortOrder : index
      }
    ]
  })
}

/** 规范化学生职务分配，清除无效学生、职务和重复项 */
function normalizeRoleAssignments(
  chart: SeatingChartType,
  studentIds: Set<string>,
  roles: SeatingRoleDefinitionType[]
): SeatingRoleAssignmentType[] {
  if (!Array.isArray(chart.roleAssignments)) return []
  const roleIds = new Set(roles.map((role) => role.id))
  const assignments = new Map<string, Set<string>>()
  chart.roleAssignments.forEach((assignment) => {
    if (!studentIds.has(assignment?.studentId) || !Array.isArray(assignment.roleIds)) return
    const assignedRoles = assignments.get(assignment.studentId) || new Set<string>()
    assignment.roleIds.forEach((roleId) => {
      if (roleIds.has(roleId)) assignedRoles.add(roleId)
    })
    if (assignedRoles.size) assignments.set(assignment.studentId, assignedRoles)
  })
  return [...assignments].map(([studentId, assignedRoles]) => ({
    studentId,
    roleIds: [...assignedRoles]
  }))
}

/** 旧版座位表结构：firstColumnSide 可能缺失，viewDirection 为旧字段 */
interface LegacySeatingChartType extends Omit<SeatingChartType, 'firstColumnSide'> {
  firstColumnSide?: SeatingFirstColumnSideEnum
  viewDirection?: 'facing-platform' | 'facing-students'
}

/** 创建讲台左右两侧的特殊座位（默认关闭且无学生） */
export function createSpecialSeats(): SeatingSpecialSeatType[] {
  return [
    { position: SeatingSpecialSeatPositionEnum.PlatformLeft, enabled: false, studentId: null },
    { position: SeatingSpecialSeatPositionEnum.PlatformRight, enabled: false, studentId: null }
  ]
}

/**
 * 按行列生成普通座位列表，座位按行优先顺序排列。
 * @param rows - 行数
 * @param columns - 列数
 * @returns 座位数组，每项含行、列及空的 studentId
 */
export function createSeats(rows: number, columns: number): SeatPositionType[] {
  return Array.from({ length: rows * columns }, (_, index) => ({
    row: Math.floor(index / columns),
    column: index % columns,
    studentId: null
  }))
}

/** 生成座位的唯一键（行-列），用于座位与学生映射 */
export function getSeatKey(row: number, column: number): string {
  return `${row}-${column}`
}

/**
 * 按新行列尺寸调整座位，尽量保留原座位上的学生。
 * @param chart - 座位表
 * @param rows - 新行数
 * @param columns - 新列数
 * @returns 调整后的座位数组
 */
export function resizeSeats(
  chart: SeatingChartType,
  rows: number,
  columns: number
): SeatPositionType[] {
  const existing = new Map(
    chart.seats.map((seat) => [getSeatKey(seat.row, seat.column), seat.studentId])
  )
  return createSeats(rows, columns).map((seat) => ({
    ...seat,
    studentId: existing.get(getSeatKey(seat.row, seat.column)) || null
  }))
}

/**
 * 统计调整尺寸后会因超出范围而丢失学生的座位数量。
 * @param chart - 座位表
 * @param rows - 新行数
 * @param columns - 新列数
 * @returns 受影响（将被移除）的已占用座位数
 */
export function getResizeAffectedCount(
  chart: SeatingChartType,
  rows: number,
  columns: number
): number {
  return chart.seats.filter(
    (seat) => seat.studentId && (seat.row >= rows || seat.column >= columns)
  ).length
}

/**
 * 将座位表数据规范化为当前结构：补齐 firstColumnSide、限制行列范围、
 * 清除无效/重复学生，并清理过道列。
 * @param chart - 原始座位表
 * @param studentIds - 当前有效的学生 ID 集合
 * @returns 规范化后的座位表
 */
export function normalizeChart(chart: SeatingChartType, studentIds: Set<string>): SeatingChartType {
  const legacyChart = chart as LegacySeatingChartType
  // 旧版用 viewDirection 表达朝向，兼容映射为 firstColumnSide。
  const firstColumnSide =
    legacyChart.firstColumnSide === SeatingFirstColumnSideEnum.Right ||
    legacyChart.viewDirection === 'facing-students'
      ? SeatingFirstColumnSideEnum.Right
      : SeatingFirstColumnSideEnum.Left
  const rows = Math.min(
    SEATING_CHART_MAX_SIZE,
    Math.max(SEATING_CHART_MIN_SIZE, Math.floor(chart.rows))
  )
  const columns = Math.min(
    SEATING_CHART_MAX_SIZE,
    Math.max(SEATING_CHART_MIN_SIZE, Math.floor(chart.columns))
  )
  const seen = new Set<string>()
  const stored = new Map(
    chart.seats.map((seat) => [getSeatKey(seat.row, seat.column), seat.studentId])
  )
  // 重建座位时只保留有效且未重复的学生，其余清空。
  const seats = createSeats(rows, columns).map((seat) => {
    const studentId = stored.get(getSeatKey(seat.row, seat.column))
    if (!studentId || !studentIds.has(studentId) || seen.has(studentId)) return seat
    seen.add(studentId)
    return { ...seat, studentId }
  })
  const storedSpecialSeats = Array.isArray(chart.specialSeats) ? chart.specialSeats : []
  const specialSeats = createSpecialSeats().map((defaultSeat) => {
    const storedSeat = storedSpecialSeats.find((seat) => seat.position === defaultSeat.position)
    const studentId = storedSeat?.studentId
    if (!storedSeat?.enabled || !studentId || !studentIds.has(studentId) || seen.has(studentId)) {
      return { ...defaultSeat, enabled: storedSeat?.enabled === true }
    }
    seen.add(studentId)
    return { ...defaultSeat, enabled: true, studentId }
  })
  const normalizedChart = { ...legacyChart }
  delete normalizedChart.viewDirection
  const roleDefinitions = normalizeRoleDefinitions(chart)
  return {
    ...normalizedChart,
    rows,
    columns,
    firstColumnSide,
    seats,
    specialSeats,
    roleDefinitions,
    roleAssignments: normalizeRoleAssignments(chart, studentIds, roleDefinitions),
    notes: typeof chart.notes === 'string' ? chart.notes : '',
    // 过道列需去重、取整并落在有效列区间内。
    aisleAfterColumns: [...new Set(chart.aisleAfterColumns)]
      .filter((column) => Number.isInteger(column) && column >= 0 && column < columns - 1)
      .sort((a, b) => a - b)
  }
}

/** Fisher-Yates 洗牌，返回打乱后的新数组 */
export function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[next]] = [result[next], result[index]]
  }
  return result
}

/**
 * 随机分配学生到空座位。
 * @param chart - 座位表
 * @param studentIds - 候选学生 ID 列表
 * @param supplement - 是否为补充模式（保留已安排学生，只填剩余空位）
 * @returns 新座位、随机分配的学生 ID 及未分配学生信息
 */
export function createRandomSeats(
  chart: SeatingChartType,
  studentIds: string[],
  supplement = false
) {
  const seats = supplement
    ? chart.seats.map((seat) => ({ ...seat }))
    : createSeats(chart.rows, chart.columns)
  const assigned = new Set([
    ...seats.map((seat) => seat.studentId).filter(Boolean),
    ...chart.specialSeats.map((seat) => seat.studentId).filter(Boolean)
  ] as string[])
  const candidates = studentIds.filter((id) => !assigned.has(id))
  /**
   * 随机排座只打乱学生，不打乱座位位置。
   * 按排、列从前往后填充，人数不足时空座会稳定集中在最后一排。
   * 补充模式沿用同一顺序，但不会移动已经安排好的学生。
   */
  const emptySeats = seats
    .filter((seat) => !seat.studentId)
    .sort((left, right) => left.row - right.row || left.column - right.column)
  const shuffledCandidates = shuffled(candidates)
  const randomizedStudentIds = shuffledCandidates.slice(0, emptySeats.length)
  const unassignedStudentIds = shuffledCandidates.slice(emptySeats.length)
  emptySeats.forEach((seat, index) => {
    seat.studentId = randomizedStudentIds[index] || null
  })
  return {
    seats,
    randomizedStudentIds,
    unassignedCount: unassignedStudentIds.length,
    unassignedStudentIds
  }
}

/**
 * 按第一列朝向返回展示顺序的座位列表。
 * @param chart - 座位表
 * @returns 排序后的座位数组（先按行，再按列，朝向右侧时列倒序）
 */
export function getVisibleSeats(chart: SeatingChartType): SeatPositionType[] {
  const seats = [...chart.seats]
  const columnOrder = chart.firstColumnSide === SeatingFirstColumnSideEnum.Right ? -1 : 1
  return seats.sort((a, b) => a.row - b.row || (a.column - b.column) * columnOrder)
}
