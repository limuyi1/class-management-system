import { db, DB_ID } from '@/db'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { useSeatingChartStore } from '@/stores/seating-chart'
import {
  pruneLinkedNoticeStudents,
  pruneRecentScoreEntries,
  pruneSystemDutyRosters,
  pruneSystemSeatingCharts
} from '@/utils/studentDeletionUtil'

/** 删除系统学生，同时清理各业务 Store 中按 studentId 关联的数据。 */
export function deleteSystemStudent(studentId: string): boolean {
  const dataStore = useDataSourceStore()
  const index = dataStore.students.findIndex((student) => student.studentId === studentId)
  if (index < 0) return false

  dataStore.students.splice(index, 1)
  const validIds = new Set(dataStore.students.map((student) => student.studentId))
  const configuration = useConfigurationStore()
  const seating = useSeatingChartStore()
  const duty = useDutyRosterStore()
  const notice = useScoreNoticeStore()

  configuration.recentScoreEntries = pruneRecentScoreEntries(
    configuration.recentScoreEntries,
    validIds
  )
  seating.charts = pruneSystemSeatingCharts(seating.charts, validIds)
  duty.rosters = pruneSystemDutyRosters(duty.rosters, validIds)
  notice.students = pruneLinkedNoticeStudents(notice.students, validIds)
  if (!notice.students.some((student) => student.id === notice.selectedStudentId)) {
    notice.selectedStudentId = notice.students[0]?.id || ''
  }
  useOverviewAnalysisStore().clearAnalysis()
  return true
}

/** 修复历史上已删除学生留下的 ID 引用；独立 Excel 数据保持原样。 */
export async function repairOrphanedSystemStudents(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.studentDataset,
      db.appPreferences,
      db.seatingCharts,
      db.dutyRosters,
      db.scoreNotice,
      db.overviewAnalysisCache
    ],
    async () => {
      const [dataset, preferences, seating, duty, notice, analysis] = await Promise.all([
        db.studentDataset.get(DB_ID),
        db.appPreferences.get(DB_ID),
        db.seatingCharts.get(DB_ID),
        db.dutyRosters.get(DB_ID),
        db.scoreNotice.get(DB_ID),
        db.overviewAnalysisCache.get(DB_ID)
      ])
      const validIds = new Set((dataset?.students ?? []).map((student) => student.studentId))
      const now = new Date().toISOString()
      let changed = false

      if (preferences) {
        const recentScoreEntries = pruneRecentScoreEntries(
          preferences.recentScoreEntries ?? {},
          validIds
        )
        if (JSON.stringify(recentScoreEntries) !== JSON.stringify(preferences.recentScoreEntries)) {
          await db.appPreferences.put({ ...preferences, recentScoreEntries, updatedAt: now })
          changed = true
        }
      }
      if (seating) {
        const charts = pruneSystemSeatingCharts(seating.charts, validIds)
        if (JSON.stringify(charts) !== JSON.stringify(seating.charts)) {
          await db.seatingCharts.put({ ...seating, charts, updatedAt: now })
          changed = true
        }
      }
      if (duty) {
        const rosters = pruneSystemDutyRosters(duty.rosters, validIds)
        if (JSON.stringify(rosters) !== JSON.stringify(duty.rosters)) {
          await db.dutyRosters.put({ ...duty, rosters, updatedAt: now })
          changed = true
        }
      }
      if (notice) {
        const students = pruneLinkedNoticeStudents(notice.students, validIds)
        if (students.length !== notice.students.length) {
          const selectedStudentId = students.some((student) => student.id === notice.selectedStudentId)
            ? notice.selectedStudentId
            : students[0]?.id || ''
          await db.scoreNotice.put({ ...notice, students, selectedStudentId, updatedAt: now })
          changed = true
        }
      }
      if ((changed || !analysis?.inputFingerprint) && analysis?.analysisText) {
        await db.overviewAnalysisCache.put({
          ...analysis,
          analysisText: '',
          generatedAt: '',
          inputFingerprint: '',
          updatedAt: now
        })
      }
    }
  )
}
