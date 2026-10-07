import type { RecentScoreEntryType } from '@/types/Configuration'
import type { DutyRosterType } from '@/types/DutyRoster'
import type { ScoreNoticeStudentType } from '@/types/ScoreNotice'
import type { SeatingChartType } from '@/types/SeatingChart'

/** 清理成绩录入历史中已不存在的系统学生。 */
export function pruneRecentScoreEntries(
  entries: Record<string, RecentScoreEntryType[]>,
  validIds: Set<string>
): Record<string, RecentScoreEntryType[]> {
  return Object.fromEntries(
    Object.entries(entries).map(([prop, records]) => [
      prop,
      records.filter((record) => validIds.has(record.studentId))
    ])
  )
}

/** 只清理系统学生来源的座位和角色；独立 Excel 名单不受影响。 */
export function pruneSystemSeatingCharts(
  charts: SeatingChartType[],
  validIds: Set<string>
): SeatingChartType[] {
  return charts.map((chart) => {
    if (chart.studentSource === 'excel' || (!chart.studentSource && chart.excelSource?.students.length)) {
      return chart
    }
    return {
      ...chart,
      seats: chart.seats.map((seat) => ({
        ...seat,
        studentId: seat.studentId && validIds.has(seat.studentId) ? seat.studentId : null
      })),
      specialSeats: chart.specialSeats.map((seat) => ({
        ...seat,
        studentId: seat.studentId && validIds.has(seat.studentId) ? seat.studentId : null
      })),
      roleAssignments: chart.roleAssignments.filter((item) => validIds.has(item.studentId))
    }
  })
}

/** 清理系统值日表中已删除学生的卡片、岗位和两类组长记录。 */
export function pruneSystemDutyRosters(
  rosters: DutyRosterType[],
  validIds: Set<string>
): DutyRosterType[] {
  return rosters.map((roster) => {
    if (roster.studentSource === 'excel' || (!roster.studentSource && roster.excelSource?.students.length)) {
      return roster
    }
    const studentCardCounts = roster.studentCardCounts
      ? Object.fromEntries(
          Object.entries(roster.studentCardCounts).filter(([id]) => validIds.has(id))
        )
      : undefined
    return {
      ...roster,
      assignments: roster.assignments.flatMap((assignment) => {
        const studentIds = assignment.studentIds.filter((id) => validIds.has(id))
        return studentIds.length ? [{ ...assignment, studentIds }] : []
      }),
      leaders: roster.leaders.filter((leader) => validIds.has(leader.studentId)),
      studentCardCounts,
      sections: roster.sections.map((section) => {
        if (!section.leaderStudentId || validIds.has(section.leaderStudentId)) return section
        const { leaderStudentId, ...remaining } = section
        void leaderStudentId
        return remaining
      })
    }
  })
}

/** 成绩通知单仅清理明确关联到系统学生 ID 的条目。 */
export function pruneLinkedNoticeStudents(
  students: ScoreNoticeStudentType[],
  validIds: Set<string>
): ScoreNoticeStudentType[] {
  return students.filter((student) =>
    student.sourceStudentId ? validIds.has(student.sourceStudentId) : true
  )
}
