import { defineStore } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import {
  SeatingFirstColumnSideEnum,
  type SeatingChartStateType,
  type SeatingChartType,
  type SeatPositionType
} from '@/types/SeatingChart'
import {
  createRandomSeats,
  createDefaultSeatingRoles,
  createSeats,
  createSpecialSeats,
  normalizeChart,
  resizeSeats
} from '@/utils/seating-chart/seatingChartUtil'
import { resolveSeatingChartStudents } from '@/utils/seating-chart/seatingChartStudentUtil'

import type {
  ExcelStudentSourceType,
  StudentSourceStudentType,
  StudentSourceType
} from '@/types/StudentSource'
import type { SeatingRoleAssignmentType, SeatingRoleDefinitionType } from '@/types/SeatingChart'

/** 创建座位表的选项 */
interface CreateSeatingChartOptionsType {
  /** 座位表名称 */
  name?: string
  /** 行数 */
  rows?: number
  /** 列数 */
  columns?: number
  /** 首列朝向 */
  firstColumnSide?: SeatingFirstColumnSideEnum
  /** 学生来源 */
  studentSource: StudentSourceType
  /** Excel 学生来源（学生来源为 excel 时使用） */
  excelSource?: ExcelStudentSourceType
}

/** 获取当前 ISO 时间戳 */
const now = (): string => new Date().toISOString()
/** 生成全局唯一 ID */
const createId = (): string => crypto.randomUUID()

/** 清空座位表所有座位上的学生 */
const clearChartAssignments = (chart: SeatingChartType): void => {
  chart.seats.forEach((seat) => {
    seat.studentId = null
  })
  chart.specialSeats.forEach((seat) => {
    seat.studentId = null
  })
  chart.roleAssignments = []
}

/**
 * 根据系统学生数据解析座位表实际应使用的学生来源
 * @param chart - 座位表
 * @param hasSystemStudents - 系统是否存在启用学生
 * @returns 解析后的学生来源
 */
const resolveStoredStudentSource = (
  chart: SeatingChartType,
  hasSystemStudents: boolean
): StudentSourceType => {
  if (chart.studentSource === 'system' || chart.studentSource === 'excel') {
    return chart.studentSource
  }
  if (hasSystemStudents) return 'system'
  return chart.excelSource?.students.length ? 'excel' : 'system'
}

/**
 * 座位表状态管理
 * 管理教室座位表的创建、编辑、随机排座、学生分配等操作
 */
export const useSeatingChartStore = defineStore('seatingChart', {
  state: (): SeatingChartStateType => ({
    /** 所有座位表 */
    charts: [],
    /** 当前正在编辑的座位表 ID */
    editingChartId: null,
    /** 侧边栏是否折叠 */
    isSidebarCollapsed: false
  }),
  getters: {
    /**
     * 当前正在编辑的座位表
     * @returns 编辑中的座位表，未选中返回 null
     */
    editingChart: (state): SeatingChartType | null =>
      state.charts.find((chart) => chart.id === state.editingChartId) || null,
    /** 当前座位表可用的学生列表（按学生来源解析） */
    activeStudents(): ReturnType<typeof resolveSeatingChartStudents> {
      return resolveSeatingChartStudents(this.editingChart, useDataSourceStore().enabledData)
    },
    /** 已被分配到座位的所有学生 ID */
    assignedStudentIds(): string[] {
      if (!this.editingChart) return []
      return [...this.editingChart.seats, ...this.editingChart.specialSeats].flatMap((seat) =>
        seat.studentId ? [seat.studentId] : []
      )
    },
    /** 尚未分配的学生列表 */
    unassignedStudents(): ReturnType<typeof resolveSeatingChartStudents> {
      const assignedIds = new Set(this.assignedStudentIds)
      return this.activeStudents.filter((student) => !assignedIds.has(student.id))
    },
    /** 座位总容量（普通座位 + 已启用的特殊座位） */
    seatCapacity(): number {
      if (!this.editingChart) return 0
      return (
        this.editingChart.seats.length +
        this.editingChart.specialSeats.filter((seat) => seat.enabled).length
      )
    },
    /** 已分配学生数量 */
    assignedCount(): number {
      return this.assignedStudentIds.length
    },
    /** 座位表是否为空（无任何学生分配） */
    isEmptyChart(): boolean {
      return this.assignedCount === 0
    }
  },
  actions: {
    /**
     * 创建新的座位表
     * @param options - 创建选项
     * @returns 新建的座位表
     */
    createChart(options: CreateSeatingChartOptionsType): SeatingChartType {
      const timestamp = now()
      const rows = options.rows ?? 6
      const columns = options.columns ?? 6
      const chart: SeatingChartType = {
        id: createId(),
        name: options.name?.trim() || `座位表 ${this.charts.length + 1}`,
        studentSource: options.studentSource,
        excelSource:
          options.studentSource === 'excel' && options.excelSource
            ? {
                fileName: options.excelSource.fileName,
                students: options.excelSource.students.map((student) => ({ ...student }))
              }
            : undefined,
        rows,
        columns,
        aisleAfterColumns: [],
        firstColumnSide: options.firstColumnSide ?? SeatingFirstColumnSideEnum.Left,
        seats: createSeats(rows, columns),
        specialSeats: createSpecialSeats(),
        roleDefinitions: createDefaultSeatingRoles(),
        roleAssignments: [],
        notes: '',
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.charts.push(chart)
      this.editingChartId = chart.id
      return chart
    },
    /**
     * 复制座位表
     * @param chartId - 要复制的座位表 ID
     */
    copyChart(chartId: string): void {
      const chart = this.charts.find((item) => item.id === chartId)
      if (!chart) return
      const timestamp = now()
      const copy: SeatingChartType = {
        ...chart,
        id: createId(),
        name: `${chart.name} 副本`,
        excelSource: chart.excelSource
          ? {
              fileName: chart.excelSource.fileName,
              students: chart.excelSource.students.map((student) => ({ ...student }))
            }
          : undefined,
        seats: chart.seats.map((seat) => ({ ...seat })),
        specialSeats: chart.specialSeats.map((seat) => ({ ...seat })),
        roleDefinitions: chart.roleDefinitions.map((role) => ({ ...role })),
        roleAssignments: chart.roleAssignments.map((assignment) => ({
          ...assignment,
          roleIds: [...assignment.roleIds]
        })),
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.charts.push(copy)
      this.editingChartId = copy.id
    },
    /**
     * 重命名座位表
     * @param chartId - 座位表 ID
     * @param name - 新名称
     */
    renameChart(chartId: string, name: string): void {
      const chart = this.charts.find((item) => item.id === chartId)
      if (!chart || !name.trim()) return
      chart.name = name.trim()
      chart.updatedAt = now()
    },
    /**
     * 删除座位表
     * @param chartId - 要删除的座位表 ID
     */
    deleteChart(chartId: string): void {
      const index = this.charts.findIndex((chart) => chart.id === chartId)
      if (index < 0) return
      this.charts.splice(index, 1)
      if (this.editingChartId === chartId) this.editingChartId = this.charts[0]?.id || null
    },
    /**
     * 切换到指定座位表进行编辑
     * @param chartId - 座位表 ID
     */
    setEditingChart(chartId: string): void {
      if (this.charts.some((chart) => chart.id === chartId)) this.editingChartId = chartId
    },
    /** 进入新建座位表状态（清空当前编辑项） */
    startCreatingChart(): void {
      this.editingChartId = null
    },
    /**
     * 设置侧边栏折叠状态
     * @param value - 是否折叠
     */
    setSidebarCollapsed(value: boolean): void {
      this.isSidebarCollapsed = value
    },
    /**
     * 设置学生来源
     * 更换来源后清空所有座位分配
     * @param source - 学生来源
     * @param excelSource - Excel 来源（可选）
     */
    setStudentSource(source: StudentSourceType, excelSource?: ExcelStudentSourceType): void {
      const chart = this.editingChart
      if (!chart) return
      chart.studentSource = source
      if (excelSource) {
        chart.excelSource = {
          fileName: excelSource.fileName,
          students: excelSource.students.map((student) => ({ ...student }))
        }
      }
      clearChartAssignments(chart)
      chart.updatedAt = now()
    },
    /**
     * 向当前座位表保存的 Excel 名单追加一名学生。
     * 不更换学生来源，也不改变已有座位与职务安排。
     * @param name - 学生姓名
     * @returns 新增学生；当前不是 Excel 来源或姓名为空时返回 null
     */
    addExcelStudent(name: string): StudentSourceStudentType | null {
      const chart = this.editingChart
      const normalizedName = name.trim()
      if (!chart || chart.studentSource !== 'excel' || !chart.excelSource || !normalizedName) {
        return null
      }
      const student: StudentSourceStudentType = {
        id: `manual:${createId()}`,
        name: normalizedName
      }
      chart.excelSource.students.push(student)
      chart.updatedAt = now()
      return student
    },
    /**
     * 从当前座位表的 Excel 名单删除一名学生，并清理其座位与职务。
     * @param studentId - 学生 ID
     * @returns 是否成功删除
     */
    removeExcelStudent(studentId: string): boolean {
      const chart = this.editingChart
      if (!chart || chart.studentSource !== 'excel' || !chart.excelSource) return false
      const studentIndex = chart.excelSource.students.findIndex(
        (student) => student.id === studentId
      )
      if (studentIndex < 0) return false

      chart.excelSource.students.splice(studentIndex, 1)
      chart.seats.forEach((seat) => {
        if (seat.studentId === studentId) seat.studentId = null
      })
      chart.specialSeats.forEach((seat) => {
        if (seat.studentId === studentId) seat.studentId = null
      })
      chart.roleAssignments = chart.roleAssignments.filter(
        (assignment) => assignment.studentId !== studentId
      )
      chart.updatedAt = now()
      return true
    },
    /**
     * 设置首列朝向
     * @param side - 首列方向
     */
    setFirstColumnSide(side: SeatingFirstColumnSideEnum): void {
      if (!this.editingChart) return
      this.editingChart.firstColumnSide = side
      this.editingChart.updatedAt = now()
    },
    /**
     * 调整座位表行列数
     * @param rows - 行数
     * @param columns - 列数
     */
    resizeChart(rows: number, columns: number): void {
      if (!this.editingChart) return
      this.editingChart.seats = resizeSeats(this.editingChart, rows, columns)
      this.editingChart.rows = rows
      this.editingChart.columns = columns
      this.editingChart.aisleAfterColumns = this.editingChart.aisleAfterColumns.filter(
        (item) => item < columns - 1
      )
      this.editingChart.updatedAt = now()
    },
    /**
     * 设置过道位置（去重并按列序号升序保存）
     * @param aisles - 过道所在的列序号列表
     */
    setAisles(aisles: number[]): void {
      if (!this.editingChart) return
      this.editingChart.aisleAfterColumns = [...new Set(aisles)]
        .filter((item) => item >= 0 && item < this.editingChart!.columns - 1)
        .sort((a, b) => a - b)
      this.editingChart.updatedAt = now()
    },
    /**
     * 保存职务定义与学生分配。
     * @param definitions - 职务定义列表
     * @param assignments - 学生职务分配列表
     */
    setRoleSettings(
      definitions: SeatingRoleDefinitionType[],
      assignments: SeatingRoleAssignmentType[]
    ): void {
      const chart = this.editingChart
      if (!chart) return
      const roleIds = new Set(definitions.map((role) => role.id))
      const studentIds = new Set(this.activeStudents.map((student) => student.id))
      chart.roleDefinitions = definitions.map((role, index) => ({
        ...role,
        subject: role.subject.trim(),
        title: role.title.trim(),
        groupName: role.groupName.trim(),
        shortLabel: role.shortLabel.trim(),
        sortOrder: index
      }))
      chart.roleAssignments = assignments.flatMap((assignment) => {
        if (!studentIds.has(assignment.studentId)) return []
        const assignedRoleIds = [...new Set(assignment.roleIds)].filter((roleId) =>
          roleIds.has(roleId)
        )
        return assignedRoleIds.length
          ? [{ studentId: assignment.studentId, roleIds: assignedRoleIds }]
          : []
      })
      chart.updatedAt = now()
    },
    /** 切换指定学生的某项职务 */
    toggleStudentRole(studentId: string, roleId: string): void {
      const chart = this.editingChart
      if (
        !chart ||
        !this.activeStudents.some((student) => student.id === studentId) ||
        !chart.roleDefinitions.some((role) => role.id === roleId)
      )
        return
      const assignment = chart.roleAssignments.find((item) => item.studentId === studentId)
      if (!assignment) chart.roleAssignments.push({ studentId, roleIds: [roleId] })
      else if (assignment.roleIds.includes(roleId)) {
        assignment.roleIds = assignment.roleIds.filter((item) => item !== roleId)
        if (!assignment.roleIds.length) {
          chart.roleAssignments = chart.roleAssignments.filter((item) => item !== assignment)
        }
      } else assignment.roleIds.push(roleId)
      chart.updatedAt = now()
    },
    /** 设置整张座位表的备注说明 */
    setNotes(notes: string): void {
      if (!this.editingChart) return
      this.editingChart.notes = notes.trim()
      this.editingChart.updatedAt = now()
    },
    /**
     * 启用或禁用特殊座位，禁用时清空该座位上的学生
     * @param position - 特殊座位位置
     * @param enabled - 是否启用
     */
    setSpecialSeatEnabled(
      position: SeatingChartType['specialSeats'][number]['position'],
      enabled: boolean
    ): void {
      const chart = this.editingChart
      const seat = chart?.specialSeats.find((item) => item.position === position)
      if (!chart || !seat) return
      seat.enabled = enabled
      if (!enabled) seat.studentId = null
      chart.updatedAt = now()
    },
    /**
     * 将学生分配到指定座位，若学生已占用其他座位则交换
     * @param studentId - 学生 ID
     * @param row - 目标行
     * @param column - 目标列
     */
    assignStudent(studentId: string, row: number, column: number): void {
      const chart = this.editingChart
      if (!chart) return
      const target = chart.seats.find((seat) => seat.row === row && seat.column === column)
      if (!target) return
      const source = [...chart.seats, ...chart.specialSeats].find(
        (seat) => seat.studentId === studentId
      )
      // 学生已占用其他座位时，交换两个座位上的学生
      if (source) source.studentId = target.studentId
      target.studentId = studentId
      chart.updatedAt = now()
    },
    /**
     * 将学生分配到已启用的特殊座位
     * @param studentId - 学生 ID
     * @param position - 特殊座位位置
     */
    assignStudentToSpecial(
      studentId: string,
      position: SeatingChartType['specialSeats'][number]['position']
    ): void {
      const chart = this.editingChart
      if (!chart) return
      const target = chart.specialSeats.find((seat) => seat.position === position && seat.enabled)
      if (!target) return
      const source = [...chart.seats, ...chart.specialSeats].find(
        (seat) => seat.studentId === studentId
      )
      if (source) source.studentId = target.studentId
      target.studentId = studentId
      chart.updatedAt = now()
    },
    /**
     * 取消学生的座位分配
     * @param studentId - 学生 ID
     */
    unassignStudent(studentId: string): void {
      const chart = this.editingChart
      const seat = chart
        ? [...chart.seats, ...chart.specialSeats].find((item) => item.studentId === studentId)
        : null
      if (!chart || !seat) return
      seat.studentId = null
      chart.updatedAt = now()
    },
    /**
     * 随机分配所有未排座学生
     * @returns 因座位不足而未能排座的学生数量
     */
    randomizeAll(): number {
      const chart = this.editingChart
      if (!chart) return 0
      const result = createRandomSeats(
        chart,
        this.activeStudents.map((student) => student.id)
      )
      chart.seats = result.seats
      chart.updatedAt = now()
      return result.unassignedCount
    },
    /**
     * 应用补位预览结果
     * @param seats - 预览生成的座位数组
     */
    applySupplementPreview(seats: SeatPositionType[]): void {
      if (!this.editingChart) return
      this.editingChart.seats = seats.map((seat) => ({ ...seat }))
      this.editingChart.updatedAt = now()
    },
    /**
     * 根据系统学生数据清洗/同步所有座位表的学生分配
     * 移除已不存在或已禁用的学生
     */
    reconcileStudents(): void {
      const systemStudents = useDataSourceStore().enabledData
      this.charts = this.charts.map((chart) => {
        const normalizedChart = {
          ...chart,
          studentSource: resolveStoredStudentSource(chart, systemStudents.length > 0)
        }
        const students = resolveSeatingChartStudents(normalizedChart, systemStudents)
        return normalizeChart(normalizedChart, new Set(students.map((student) => student.id)))
      })
      if (!this.charts.some((chart) => chart.id === this.editingChartId)) {
        this.editingChartId = this.charts[0]?.id || null
      }
    }
  }
})
