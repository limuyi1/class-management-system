import { defineStore } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import {
  DutyRosterModeEnum,
  type DutyAssignmentTargetType,
  type DutyRosterStateType,
  type DutyRosterType,
  type DutySectionKindType
} from '@/types/DutyRoster'
import {
  createDefaultDutyNotes,
  createDefaultDutySections,
  createDefaultDutyWeeklyRows,
  createDutyPosition,
  createDutyWeeklyRow,
  findDutySectionByPosition,
  getDutyAssignment,
  getDutyPositionStudentCount,
  getDutyStudentIds,
  normalizeDutyRoster,
  removeDutyStudent
} from '@/utils/dutyRosterUntil'
import { resolveDutyRosterStudents } from '@/utils/dutyRosterStudentUntil'

import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

interface CreateDutyRosterOptionsType {
  name?: string
  mode?: DutyRosterModeEnum
  studentSource: StudentSourceType
  excelSource?: ExcelStudentSourceType
}

const now = (): string => new Date().toISOString()
const createId = (): string => crypto.randomUUID()

const cloneExcelSource = (
  source: ExcelStudentSourceType | undefined
): ExcelStudentSourceType | undefined =>
  source
    ? {
        fileName: source.fileName,
        students: source.students.map((student) => ({ ...student }))
      }
    : undefined

const touch = (roster: DutyRosterType): void => {
  roster.updatedAt = now()
}

export const useDutyRosterStore = defineStore('dutyRoster', {
  state: (): DutyRosterStateType => ({
    rosters: [],
    editingRosterId: null,
    isSidebarCollapsed: false
  }),
  getters: {
    editingRoster: (state): DutyRosterType | null =>
      state.rosters.find((roster) => roster.id === state.editingRosterId) || null,
    activeStudents(): ReturnType<typeof resolveDutyRosterStudents> {
      return resolveDutyRosterStudents(this.editingRoster, useDataSourceStore().enabledData)
    },
    assignedStudentIds(): string[] {
      return this.editingRoster ? getDutyStudentIds(this.editingRoster) : []
    },
    unassignedStudents(): ReturnType<typeof resolveDutyRosterStudents> {
      const assignedIds = new Set(this.assignedStudentIds)
      return this.activeStudents.filter((student) => !assignedIds.has(student.id))
    },
    assignedCount(): number {
      return this.assignedStudentIds.length
    }
  },
  actions: {
    createRoster(options: CreateDutyRosterOptionsType): DutyRosterType {
      const timestamp = now()
      const roster: DutyRosterType = {
        id: createId(),
        name: options.name?.trim() || '班级值日安排',
        mode: options.mode ?? DutyRosterModeEnum.Daily,
        studentSource: options.studentSource,
        excelSource:
          options.studentSource === 'excel' ? cloneExcelSource(options.excelSource) : undefined,
        sections: createDefaultDutySections(),
        weeklyRows: createDefaultDutyWeeklyRows(),
        assignments: [],
        leaders: [],
        notes: createDefaultDutyNotes(),
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.rosters.push(roster)
      this.editingRosterId = roster.id
      return roster
    },
    startCreatingRoster(): void {
      this.editingRosterId = null
    },
    setEditingRoster(rosterId: string): void {
      if (this.rosters.some((roster) => roster.id === rosterId)) this.editingRosterId = rosterId
    },
    setSidebarCollapsed(value: boolean): void {
      this.isSidebarCollapsed = value
    },
    renameRoster(rosterId: string, name: string): void {
      const roster = this.rosters.find((item) => item.id === rosterId)
      if (!roster || !name.trim()) return
      roster.name = name.trim()
      touch(roster)
    },
    copyRoster(rosterId: string): void {
      const roster = this.rosters.find((item) => item.id === rosterId)
      if (!roster) return
      const timestamp = now()
      const copy: DutyRosterType = {
        ...roster,
        id: createId(),
        name: `${roster.name} 副本`,
        excelSource: cloneExcelSource(roster.excelSource),
        sections: roster.sections.map((section) => ({
          ...section,
          positions: section.positions.map((position) => ({ ...position }))
        })),
        weeklyRows: (roster.weeklyRows?.length
          ? roster.weeklyRows
          : createDefaultDutyWeeklyRows()
        ).map((row) => ({ ...row })),
        assignments: roster.assignments.map((assignment) => ({
          ...assignment,
          studentIds: [...assignment.studentIds]
        })),
        leaders: roster.leaders.map((leader) => ({ ...leader })),
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.rosters.push(copy)
      this.editingRosterId = copy.id
    },
    deleteRoster(rosterId: string): void {
      const index = this.rosters.findIndex((roster) => roster.id === rosterId)
      if (index < 0) return
      this.rosters.splice(index, 1)
      if (this.editingRosterId === rosterId) this.editingRosterId = this.rosters[0]?.id || null
    },
    setMode(mode: DutyRosterModeEnum): void {
      if (!this.editingRoster || this.editingRoster.mode === mode) return
      this.editingRoster.mode = mode
      if (!this.editingRoster.weeklyRows?.length) {
        this.editingRoster.weeklyRows = createDefaultDutyWeeklyRows()
      }
      this.editingRoster.assignments = []
      this.editingRoster.leaders = []
      touch(this.editingRoster)
    },
    setStudentSource(source: StudentSourceType, excelSource?: ExcelStudentSourceType): void {
      const roster = this.editingRoster
      if (!roster) return
      roster.studentSource = source
      if (excelSource) roster.excelSource = cloneExcelSource(excelSource)
      roster.assignments = []
      roster.leaders = []
      touch(roster)
    },
    setNotes(notes: string): void {
      if (!this.editingRoster) return
      this.editingRoster.notes = notes
      touch(this.editingRoster)
    },
    addSection(name: string, kind: DutySectionKindType = 'cleaning'): void {
      const roster = this.editingRoster
      if (!roster || !name.trim()) return
      roster.sections.push({
        id: createId(),
        name: name.trim(),
        kind,
        sortOrder: roster.sections.length,
        positions: [createDutyPosition('新岗位', 0)]
      })
      touch(roster)
    },
    renameSection(sectionId: string, name: string): void {
      const roster = this.editingRoster
      const section = roster?.sections.find((item) => item.id === sectionId)
      if (!roster || !section || !name.trim()) return
      section.name = name.trim()
      touch(roster)
    },
    reorderSections(sectionIds: string[]): void {
      const roster = this.editingRoster
      if (!roster) return
      const sectionMap = new Map(roster.sections.map((section) => [section.id, section]))
      const orderedSections = sectionIds.flatMap((sectionId) => {
        const section = sectionMap.get(sectionId)
        return section ? [section] : []
      })
      roster.sections.forEach((section) => {
        if (!sectionIds.includes(section.id)) orderedSections.push(section)
      })
      roster.sections = orderedSections.map((section, index) => ({
        ...section,
        sortOrder: index
      }))
      touch(roster)
    },
    removeSection(sectionId: string): void {
      const roster = this.editingRoster
      const section = roster?.sections.find((item) => item.id === sectionId)
      if (!roster || !section || roster.sections.length <= 1) return
      const positionIds = new Set(section.positions.map((position) => position.id))
      const removedStudentIds = new Set(
        roster.assignments
          .filter((assignment) => positionIds.has(assignment.positionId))
          .flatMap((assignment) => assignment.studentIds)
      )
      roster.sections = roster.sections
        .filter((item) => item.id !== sectionId)
        .map((item, index) => ({ ...item, sortOrder: index }))
      roster.assignments = roster.assignments.filter(
        (assignment) => !positionIds.has(assignment.positionId)
      )
      roster.leaders = roster.leaders.filter(
        (leader) => leader.sectionId !== sectionId && !removedStudentIds.has(leader.studentId)
      )
      touch(roster)
    },
    addPosition(sectionId: string, afterPositionId?: string): string | null {
      const roster = this.editingRoster
      const section = roster?.sections.find((item) => item.id === sectionId)
      if (!roster || !section) return null
      const insertIndex = afterPositionId
        ? Math.max(
            0,
            section.positions.findIndex((position) => position.id === afterPositionId) + 1
          )
        : section.positions.length
      const position = createDutyPosition('新岗位', insertIndex)
      section.positions.splice(insertIndex, 0, position)
      section.positions.forEach((item, index) => {
        item.sortOrder = index
      })
      touch(roster)
      return position.id
    },
    renamePosition(positionId: string, name: string): void {
      const roster = this.editingRoster
      const section = roster ? findDutySectionByPosition(roster, positionId) : undefined
      const position = section?.positions.find((item) => item.id === positionId)
      if (!roster || !position || !name.trim()) return
      position.name = name.trim()
      touch(roster)
    },
    removePosition(positionId: string): void {
      const roster = this.editingRoster
      const section = roster ? findDutySectionByPosition(roster, positionId) : undefined
      if (!roster || !section || section.positions.length <= 1) return
      const removedStudentIds = new Set(
        roster.assignments
          .filter((assignment) => assignment.positionId === positionId)
          .flatMap((assignment) => assignment.studentIds)
      )
      section.positions = section.positions
        .filter((position) => position.id !== positionId)
        .map((position, index) => ({ ...position, sortOrder: index }))
      roster.assignments = roster.assignments.filter(
        (assignment) => assignment.positionId !== positionId
      )
      roster.leaders = roster.leaders.filter((leader) => !removedStudentIds.has(leader.studentId))
      touch(roster)
    },
    reorderPosition(sectionId: string, sourceId: string, targetId: string): void {
      const roster = this.editingRoster
      const section = roster?.sections.find((item) => item.id === sectionId)
      if (!roster || !section || sourceId === targetId) return
      const sourceIndex = section.positions.findIndex((position) => position.id === sourceId)
      const targetIndex = section.positions.findIndex((position) => position.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return
      const [position] = section.positions.splice(sourceIndex, 1)
      section.positions.splice(targetIndex, 0, position)
      section.positions.forEach((item, index) => {
        item.sortOrder = index
      })
      touch(roster)
    },
    addWeeklyRow(afterRowId?: string): string | null {
      const roster = this.editingRoster
      if (!roster || roster.mode !== DutyRosterModeEnum.Weekly) return null
      if (!roster.weeklyRows?.length) roster.weeklyRows = createDefaultDutyWeeklyRows()
      const insertIndex = afterRowId
        ? Math.max(0, roster.weeklyRows.findIndex((row) => row.id === afterRowId) + 1)
        : roster.weeklyRows.length
      const row = createDutyWeeklyRow(insertIndex)
      roster.weeklyRows.splice(insertIndex, 0, row)
      roster.weeklyRows.forEach((item, index) => {
        item.sortOrder = index
      })
      touch(roster)
      return row.id
    },
    getWeeklyRowStudentCount(rowId: string): number {
      const roster = this.editingRoster
      if (!roster) return 0
      return roster.assignments
        .filter((assignment) => assignment.rowId === rowId)
        .reduce((count, assignment) => count + assignment.studentIds.length, 0)
    },
    removeWeeklyRow(rowId: string): void {
      const roster = this.editingRoster
      if (
        !roster ||
        roster.mode !== DutyRosterModeEnum.Weekly ||
        !roster.weeklyRows ||
        roster.weeklyRows.length <= 1
      ) {
        return
      }
      const removedStudentIds = new Set(
        roster.assignments
          .filter((assignment) => assignment.rowId === rowId)
          .flatMap((assignment) => assignment.studentIds)
      )
      roster.weeklyRows = roster.weeklyRows
        .filter((row) => row.id !== rowId)
        .map((row, index) => ({ ...row, sortOrder: index }))
      roster.assignments = roster.assignments.filter((assignment) => assignment.rowId !== rowId)
      roster.leaders = roster.leaders.filter(
        (leader) => leader.rowId !== rowId && !removedStudentIds.has(leader.studentId)
      )
      touch(roster)
    },
    getPositionStudentCount(positionId: string): number {
      return this.editingRoster ? getDutyPositionStudentCount(this.editingRoster, positionId) : 0
    },
    assignStudent(studentId: string, target: DutyAssignmentTargetType): void {
      const roster = this.editingRoster
      if (!roster || !findDutySectionByPosition(roster, target.positionId)) return
      const removed = removeDutyStudent(roster.assignments, roster.leaders, studentId)
      roster.assignments = removed.assignments
      roster.leaders = removed.leaders
      const assignment = getDutyAssignment(
        roster.assignments,
        target.period,
        target.positionId,
        target.rowId
      )
      if (assignment) assignment.studentIds.push(studentId)
      else roster.assignments.push({ ...target, studentIds: [studentId] })
      touch(roster)
    },
    unassignStudent(studentId: string): void {
      const roster = this.editingRoster
      if (!roster) return
      const result = removeDutyStudent(roster.assignments, roster.leaders, studentId)
      roster.assignments = result.assignments
      roster.leaders = result.leaders
      touch(roster)
    },
    toggleLeader(studentId: string): void {
      const roster = this.editingRoster
      if (!roster) return
      const assignment = roster.assignments.find((item) => item.studentIds.includes(studentId))
      const section = assignment
        ? findDutySectionByPosition(roster, assignment.positionId)
        : undefined
      if (!assignment || !section) return
      const existingIndex = roster.leaders.findIndex((leader) => leader.studentId === studentId)
      if (existingIndex >= 0) roster.leaders.splice(existingIndex, 1)
      else {
        roster.leaders = roster.leaders.filter(
          (leader) =>
            !(
              leader.period === assignment.period &&
              leader.rowId === assignment.rowId &&
              leader.sectionId === section.id
            )
        )
        roster.leaders.push({
          period: assignment.period,
          rowId: assignment.rowId,
          sectionId: section.id,
          studentId
        })
      }
      touch(roster)
    },
    reconcileStudents(): void {
      const systemStudents = useDataSourceStore().enabledData
      this.rosters = this.rosters.map((roster) => {
        const source =
          roster.studentSource === 'system' || roster.studentSource === 'excel'
            ? roster.studentSource
            : systemStudents.length
              ? 'system'
              : 'excel'
        const normalizedRoster = { ...roster, studentSource: source }
        const students = resolveDutyRosterStudents(normalizedRoster, systemStudents)
        return normalizeDutyRoster(normalizedRoster, new Set(students.map((student) => student.id)))
      })
      if (!this.rosters.some((roster) => roster.id === this.editingRosterId)) {
        this.editingRosterId = this.rosters[0]?.id || null
      }
    }
  }
})
