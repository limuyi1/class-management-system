import { SeatingFirstColumnSideEnum, SeatingPlatformPositionEnum } from '@/types/SeatingChart'
import { DutyRosterModeEnum } from '@/types/DutyRoster'
import {
  createSeats,
  createSpecialSeats,
  createDefaultSeatingRoles
} from '@/utils/seating-chart/seatingChartUtil'
import {
  createDefaultDutySections,
  createDefaultDutyWeeklyRows,
  createDefaultDutyNotes
} from '@/utils/duty-roster/dutyRosterUtil'
import type { SeatingChartType } from '@/types/SeatingChart'
import type { DutyRosterType } from '@/types/DutyRoster'
import type { ClassroomToolKindType } from '@/types/ApiClassroomTools'
import type { StudentSourceStudentType } from '@/types/StudentSource'

export type ToolDraftContentType = SeatingChartType | DutyRosterType
/** 新方案使用当前工作区名单，不从旧全局 Store 或浏览器缓存恢复数据。 */
export function createClassroomTool(kind: ClassroomToolKindType): ToolDraftContentType {
  const now = new Date().toISOString()
  const base = {
    id: crypto.randomUUID(),
    name: kind === 'seating' ? '新座位表' : '新值日表',
    studentSource: 'system' as const,
    notes: '',
    createdAt: now,
    updatedAt: now
  }
  return kind === 'seating'
    ? {
        ...base,
        rows: 6,
        columns: 8,
        aisleAfterColumns: [],
        firstColumnSide: SeatingFirstColumnSideEnum.Left,
        platformPosition: SeatingPlatformPositionEnum.Top,
        seats: createSeats(6, 8),
        specialSeats: createSpecialSeats(),
        roleDefinitions: createDefaultSeatingRoles(),
        roleAssignments: [],
        rotationFixedStudentIds: []
      }
    : {
        ...base,
        mode: DutyRosterModeEnum.Daily,
        sections: createDefaultDutySections(),
        weeklyRows: createDefaultDutyWeeklyRows(),
        assignments: [],
        leaders: [],
        notes: createDefaultDutyNotes()
      }
}
/** 名单变动后仅清理草稿里的无效引用；保留服务器原方案直到用户确认保存。 */
export function reconcileClassroomTool(
  content: ToolDraftContentType,
  students: StudentSourceStudentType[]
): void {
  const ids = new Set(students.map((student) => student.id))
  if ('seats' in content) {
    for (const seat of [...content.seats, ...content.specialSeats])
      if (seat.studentId && !ids.has(seat.studentId)) seat.studentId = null
    content.roleAssignments = content.roleAssignments.filter((row) => ids.has(row.studentId))
    content.rotationFixedStudentIds = content.rotationFixedStudentIds?.filter((id) => ids.has(id))
  } else {
    content.assignments.forEach((row) => {
      row.studentIds = row.studentIds.filter((id) => ids.has(id))
    })
    content.leaders = content.leaders.filter((row) => ids.has(row.studentId))
    content.sections.forEach((section) => {
      if (section.leaderStudentId && !ids.has(section.leaderStudentId))
        delete section.leaderStudentId
    })
    if (content.studentCardCounts)
      content.studentCardCounts = Object.fromEntries(
        Object.entries(content.studentCardCounts || {}).filter(([id]) => ids.has(id))
      )
  }
}
