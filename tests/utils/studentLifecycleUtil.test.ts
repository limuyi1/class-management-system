import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { deleteSystemStudent } from '@/utils/studentLifecycleUtil'
import {
  pruneLinkedNoticeStudents,
  pruneSystemDutyRosters,
  pruneSystemSeatingCharts
} from '@/utils/studentDeletionUtil'
import { ScoreNoticeCommentStatusEnum } from '@/types/ScoreNotice'

import type { DutyRosterType } from '@/types/DutyRoster'
import type { SeatingChartType } from '@/types/SeatingChart'

describe('student deletion lifecycle', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('hard deletes a student and every system ID reference', () => {
    const data = useDataSourceStore()
    data.students = [
      { studentId: 'removed', name: '吴承宇', math: 95, comment: '评语' },
      { studentId: 'kept', name: '同名学生', math: 80 }
    ]
    const configuration = useConfigurationStore()
    configuration.recentScoreEntries = {
      math: [
        { studentId: 'removed', name: '吴承宇', score: 95, time: '10:00' },
        { studentId: 'kept', name: '同名学生', score: 80, time: '10:01' }
      ]
    }
    const seating = useSeatingChartStore()
    const chart = seating.createChart({ studentSource: 'system', rows: 1, columns: 2 })
    chart.seats[0].studentId = 'removed'
    chart.seats[1].studentId = 'kept'
    chart.roleAssignments = [{ studentId: 'removed', roleIds: [chart.roleDefinitions[0].id] }]

    const duty = useDutyRosterStore()
    const roster = duty.createRoster({ studentSource: 'system' })
    roster.assignments = [{ period: 'am', positionId: roster.sections[0].positions[0].id, studentIds: ['removed', 'kept'] }] as DutyRosterType['assignments']
    roster.leaders = [{ period: 'am', sectionId: roster.sections[0].id, studentId: 'removed' }] as DutyRosterType['leaders']
    roster.studentCardCounts = { removed: 2, kept: 1 }
    roster.sections[0].leaderStudentId = 'removed'

    const notice = useScoreNoticeStore()
    notice.students = [
      { id: 'removed', sourceStudentId: 'removed', name: '吴承宇', rawValues: {}, gradeValues: {}, comment: '', commentStatus: ScoreNoticeCommentStatusEnum.Pending },
      { id: 'notice:1', name: '吴承宇', rawValues: {}, gradeValues: {}, comment: '', commentStatus: ScoreNoticeCommentStatusEnum.Pending }
    ]
    notice.selectedStudentId = 'removed'
    useOverviewAnalysisStore().setAnalysis('吴承宇需要关注')

    expect(deleteSystemStudent('removed')).toBe(true)
    expect(data.students.map((student) => student.studentId)).toEqual(['kept'])
    expect(configuration.recentScoreEntries.math.map((entry) => entry.studentId)).toEqual(['kept'])
    expect(seating.charts[0].seats.map((seat) => seat.studentId)).toEqual([null, 'kept'])
    expect(seating.charts[0].roleAssignments).toEqual([])
    expect(duty.rosters[0].assignments[0].studentIds).toEqual(['kept'])
    expect(duty.rosters[0].leaders).toEqual([])
    expect(duty.rosters[0].studentCardCounts).toEqual({ kept: 1 })
    expect(duty.rosters[0].sections[0].leaderStudentId).toBeUndefined()
    expect(notice.students.map((student) => student.id)).toEqual(['notice:1'])
    expect(notice.selectedStudentId).toBe('notice:1')
    expect(useOverviewAnalysisStore().analysisText).toBe('')
  })

  it('repairs orphan IDs but preserves independent Excel sources', () => {
    const validIds = new Set(['kept'])
    const seating = useSeatingChartStore()
    const systemChart = seating.createChart({ studentSource: 'system', rows: 1, columns: 1 })
    systemChart.seats[0].studentId = 'orphan'
    const excelChart = seating.createChart({ studentSource: 'excel', excelSource: { fileName: '名单.xlsx', students: [{ id: 'orphan', name: '吴承宇' }] }, rows: 1, columns: 1 })
    excelChart.seats[0].studentId = 'orphan'

    const charts = pruneSystemSeatingCharts([systemChart, excelChart] as SeatingChartType[], validIds)
    expect(charts[0].seats[0].studentId).toBeNull()
    expect(charts[1].seats[0].studentId).toBe('orphan')

    const duty = useDutyRosterStore()
    const systemRoster = duty.createRoster({ studentSource: 'system' })
    systemRoster.studentCardCounts = { orphan: 2 }
    systemRoster.sections[0].leaderStudentId = 'orphan'
    const excelRoster = duty.createRoster({ studentSource: 'excel', excelSource: { fileName: '名单.xlsx', students: [{ id: 'orphan', name: '吴承宇' }] } })
    excelRoster.studentCardCounts = { orphan: 2 }
    const rosters = pruneSystemDutyRosters([systemRoster, excelRoster], validIds)
    expect(rosters[0].studentCardCounts).toEqual({})
    expect(rosters[0].sections[0].leaderStudentId).toBeUndefined()
    expect(rosters[1].studentCardCounts).toEqual({ orphan: 2 })

    expect(pruneLinkedNoticeStudents([
      { id: 'orphan', sourceStudentId: 'orphan', name: '吴承宇', rawValues: {}, gradeValues: {}, comment: '', commentStatus: ScoreNoticeCommentStatusEnum.Pending },
      { id: 'notice:1', name: '吴承宇', rawValues: {}, gradeValues: {}, comment: '', commentStatus: ScoreNoticeCommentStatusEnum.Pending }
    ], validIds)).toHaveLength(1)
  })
})
