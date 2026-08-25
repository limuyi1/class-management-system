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
  createSeats,
  createSpecialSeats,
  normalizeChart,
  resizeSeats
} from '@/utils/seating-chart/seatingChartUtil'
import { resolveSeatingChartStudents } from '@/utils/seating-chart/seatingChartStudentUtil'

import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

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
