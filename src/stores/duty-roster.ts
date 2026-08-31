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
} from '@/utils/duty-roster/dutyRosterUtil'
import { resolveDutyRosterStudents } from '@/utils/duty-roster/dutyRosterStudentUtil'

import type {
  ExcelStudentSourceType,
  StudentSourceStudentType,
  StudentSourceType
} from '@/types/StudentSource'

/** 创建值日表的选项 */
interface CreateDutyRosterOptionsType {
  /** 值日表名称 */
  name?: string
  /** 值日模式（日/周） */
  mode?: DutyRosterModeEnum
  /** 学生来源 */
  studentSource: StudentSourceType
  /** Excel 学生来源（学生来源为 excel 时使用） */
  excelSource?: ExcelStudentSourceType
}

/** 获取当前 ISO 时间戳 */
const now = (): string => new Date().toISOString()
/** 生成全局唯一 ID */
const createId = (): string => crypto.randomUUID()

/**
 * 深拷贝 Excel 学生来源，避免多个值日表共享同一引用
 * @param source - 原始 Excel 来源
 * @returns 拷贝后的来源，未提供则返回 undefined
 */
const cloneExcelSource = (
  source: ExcelStudentSourceType | undefined
): ExcelStudentSourceType | undefined =>
  source
    ? {
        fileName: source.fileName,
        students: source.students.map((student) => ({ ...student }))
      }
    : undefined

/** 更新值日表的 updatedAt 时间戳 */
const touch = (roster: DutyRosterType): void => {
  roster.updatedAt = now()
}

/**
 * 值日表状态管理
 * 管理工作日/周模式的值日安排，包括分组、岗位、分配、组长设置等
 */
export const useDutyRosterStore = defineStore('dutyRoster', {
  state: (): DutyRosterStateType => ({
    /** 所有值日表 */
    rosters: [],
    /** 当前正在编辑的值日表 ID */
    editingRosterId: null,
    /** 侧边栏是否折叠 */
    isSidebarCollapsed: false
  }),
  getters: {
    /**
     * 当前正在编辑的值日表
     * @returns 编辑中的值日表，未选中返回 null
     */
    editingRoster: (state): DutyRosterType | null =>
      state.rosters.find((roster) => roster.id === state.editingRosterId) || null,
    /** 当前值日表可用的学生列表（按学生来源解析） */
    activeStudents(): ReturnType<typeof resolveDutyRosterStudents> {
      return resolveDutyRosterStudents(this.editingRoster, useDataSourceStore().enabledData)
    },
    /** 已被分配到岗位的学生 ID 列表 */
    assignedStudentIds(): string[] {
      return this.editingRoster ? getDutyStudentIds(this.editingRoster) : []
    },
    /** 尚未分配的学生列表 */
    unassignedStudents(): ReturnType<typeof resolveDutyRosterStudents> {
      const assignedIds = new Set(this.assignedStudentIds)
      return this.activeStudents.filter((student) => !assignedIds.has(student.id))
    },
    /** 已分配学生数量 */
    assignedCount(): number {
      return this.assignedStudentIds.length
    }
  },
  actions: {
    /**
     * 创建新的值日表
     * @param options - 创建选项
     * @returns 新建的值日表
     */
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
    /** 进入新建值日表状态（清空当前编辑项） */
    startCreatingRoster(): void {
      this.editingRosterId = null
    },
    /**
     * 切换到指定值日表进行编辑
     * @param rosterId - 值日表 ID
     */
    setEditingRoster(rosterId: string): void {
      if (this.rosters.some((roster) => roster.id === rosterId)) this.editingRosterId = rosterId
    },
    /**
     * 设置侧边栏折叠状态
     * @param value - 是否折叠
     */
    setSidebarCollapsed(value: boolean): void {
      this.isSidebarCollapsed = value
    },
    /**
     * 重命名值日表
     * @param rosterId - 值日表 ID
     * @param name - 新名称
     */
    renameRoster(rosterId: string, name: string): void {
      const roster = this.rosters.find((item) => item.id === rosterId)
      if (!roster || !name.trim()) return
      roster.name = name.trim()
      touch(roster)
    },
    /**
     * 复制值日表
     * @param rosterId - 要复制的值日表 ID
     */
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
    /**
     * 删除值日表
     * @param rosterId - 要删除的值日表 ID
     */
    deleteRoster(rosterId: string): void {
      const index = this.rosters.findIndex((roster) => roster.id === rosterId)
      if (index < 0) return
      this.rosters.splice(index, 1)
      if (this.editingRosterId === rosterId) this.editingRosterId = this.rosters[0]?.id || null
    },
    /**
     * 切换值日模式（日/周）
     * 切换模式会清空已有分配和组长，避免数据错位
     * @param mode - 目标模式
     */
    setMode(mode: DutyRosterModeEnum): void {
      if (!this.editingRoster || this.editingRoster.mode === mode) return
      this.editingRoster.mode = mode
      if (!this.editingRoster.weeklyRows?.length) {
        this.editingRoster.weeklyRows = createDefaultDutyWeeklyRows()
      }
      // 切换模式后原有分配与组长不再适用，统一清空
      this.editingRoster.assignments = []
      this.editingRoster.leaders = []
      touch(this.editingRoster)
    },
    /**
     * 设置学生来源
     * 更换来源后清空已有分配与组长
     * @param source - 学生来源
     * @param excelSource - Excel 来源（可选）
     */
    setStudentSource(source: StudentSourceType, excelSource?: ExcelStudentSourceType): void {
      const roster = this.editingRoster
      if (!roster) return
      roster.studentSource = source
      if (excelSource) roster.excelSource = cloneExcelSource(excelSource)
      roster.assignments = []
      roster.leaders = []
      touch(roster)
    },
    /**
     * 向当前值日表保存的 Excel 名单追加一名学生。
     * 不更换学生来源，也不改变已有岗位与组长安排。
     * @param name - 学生姓名
     * @returns 新增学生；当前不是 Excel 来源或姓名为空时返回 null
     */
    addExcelStudent(name: string): StudentSourceStudentType | null {
      const roster = this.editingRoster
      const normalizedName = name.trim()
      if (!roster || roster.studentSource !== 'excel' || !roster.excelSource || !normalizedName) {
        return null
      }
      const student: StudentSourceStudentType = {
        id: `manual:${createId()}`,
        name: normalizedName
      }
      roster.excelSource.students.push(student)
      touch(roster)
      return student
    },
    /**
     * 从当前值日表的 Excel 名单删除一名学生，并清理其岗位与组长记录。
     * @param studentId - 学生 ID
     * @returns 是否成功删除
     */
    removeExcelStudent(studentId: string): boolean {
      const roster = this.editingRoster
      if (!roster || roster.studentSource !== 'excel' || !roster.excelSource) return false
      const studentIndex = roster.excelSource.students.findIndex(
        (student) => student.id === studentId
      )
      if (studentIndex < 0) return false

      roster.excelSource.students.splice(studentIndex, 1)
      const result = removeDutyStudent(roster.assignments, roster.leaders, studentId)
      roster.assignments = result.assignments
      roster.leaders = result.leaders
      touch(roster)
      return true
    },
    /**
     * 设置值日备注
     * @param notes - 备注文本
     */
    setNotes(notes: string): void {
      if (!this.editingRoster) return
      this.editingRoster.notes = notes
      touch(this.editingRoster)
    },
    /**
     * 新增分组
     * @param name - 分组名称
     * @param kind - 分组类型（默认 cleaning）
     */
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
    /**
     * 重命名分组
     * @param sectionId - 分组 ID
     * @param name - 新名称
     */
    renameSection(sectionId: string, name: string): void {
      const roster = this.editingRoster
      const section = roster?.sections.find((item) => item.id === sectionId)
      if (!roster || !section || !name.trim()) return
      section.name = name.trim()
      touch(roster)
    },
    /**
     * 按给定顺序重排分组
     * @param sectionIds - 排序后的分组 ID 顺序
     */
    reorderSections(sectionIds: string[]): void {
      const roster = this.editingRoster
      if (!roster) return
      const sectionMap = new Map(roster.sections.map((section) => [section.id, section]))
      // 先按给定顺序排列，再追加未在列表中的分组，保证不丢失
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
    /**
     * 删除分组（至少保留一个分组）
     * 同时清理该分组下岗位的分配与组长
     * @param sectionId - 分组 ID
     */
    removeSection(sectionId: string): void {
      const roster = this.editingRoster
      const section = roster?.sections.find((item) => item.id === sectionId)
      if (!roster || !section || roster.sections.length <= 1) return
      const positionIds = new Set(section.positions.map((position) => position.id))
      // 收集该分组下被移除岗位上的学生，用于同步清理组长记录
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
    /**
     * 在指定岗位后新增岗位
     * @param sectionId - 所属分组 ID
     * @param afterPositionId - 在其后插入的岗位 ID（可选，默认追加到末尾）
     * @returns 新岗位 ID，失败返回 null
     */
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
    /**
     * 重命名岗位
     * @param positionId - 岗位 ID
     * @param name - 新名称
     */
    renamePosition(positionId: string, name: string): void {
      const roster = this.editingRoster
      const section = roster ? findDutySectionByPosition(roster, positionId) : undefined
      const position = section?.positions.find((item) => item.id === positionId)
      if (!roster || !position || !name.trim()) return
      position.name = name.trim()
      touch(roster)
    },
    /**
     * 删除岗位（分组内至少保留一个岗位）
     * 同时清理该岗位的分配与组长
     * @param positionId - 岗位 ID
     */
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
    /**
     * 调整岗位顺序
     * @param sectionId - 所属分组 ID
     * @param sourceId - 被移动的岗位 ID
     * @param targetId - 目标位置的岗位 ID
     */
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
    /**
     * 新增周行（仅周模式）
     * @param afterRowId - 在其后插入的周行 ID（可选，默认追加到末尾）
     * @returns 新周行 ID，失败返回 null
     */
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
    /**
     * 获取指定周行已分配的学生数
     * @param rowId - 周行 ID
     * @returns 学生数量
     */
    getWeeklyRowStudentCount(rowId: string): number {
      const roster = this.editingRoster
      if (!roster) return 0
      return roster.assignments
        .filter((assignment) => assignment.rowId === rowId)
        .reduce((count, assignment) => count + assignment.studentIds.length, 0)
    },
    /**
     * 删除周行（至少保留一行）
     * 同时清理该周行的分配与组长
     * @param rowId - 周行 ID
     */
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
    /**
     * 获取指定岗位已分配的学生数
     * @param positionId - 岗位 ID
     * @returns 学生数量
     */
    getPositionStudentCount(positionId: string): number {
      return this.editingRoster ? getDutyPositionStudentCount(this.editingRoster, positionId) : 0
    },
    /**
     * 将学生分配到指定岗位
     * 先移除该学生已有分配，再写入新岗位
     * @param studentId - 学生 ID
     * @param target - 分配目标（时段/岗位/周行）
     */
    assignStudent(studentId: string, target: DutyAssignmentTargetType): void {
      const roster = this.editingRoster
      const targetSection = roster
        ? findDutySectionByPosition(roster, target.positionId)
        : undefined
      if (!roster || !targetSection) return
      const shouldKeepLeader = roster.leaders.some((leader) => leader.studentId === studentId)
      // 先移除该学生原有分配，避免重复分配
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
      if (shouldKeepLeader) {
        // 拖动组长时仅迁移本人身份，目标分组已有的组长保持不变
        roster.leaders.push({
          period: target.period,
          rowId: target.rowId,
          sectionId: targetSection.id,
          studentId
        })
      }
      touch(roster)
    },
    /**
     * 取消学生的所有分配
     * @param studentId - 学生 ID
     */
    unassignStudent(studentId: string): void {
      const roster = this.editingRoster
      if (!roster) return
      const result = removeDutyStudent(roster.assignments, roster.leaders, studentId)
      roster.assignments = result.assignments
      roster.leaders = result.leaders
      touch(roster)
    },
    /**
     * 切换学生的组长身份
     * @param studentId - 学生 ID
     */
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
        roster.leaders.push({
          period: assignment.period,
          rowId: assignment.rowId,
          sectionId: section.id,
          studentId
        })
      }
      touch(roster)
    },
    /**
     * 根据系统学生数据清洗/同步所有值日表的学生分配
     * 移除已不存在或已禁用的学生
     */
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
