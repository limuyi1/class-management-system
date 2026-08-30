/** 学生数据来源相关的类型定义 */

/** 可在业务页面间复用的学生来源种类。 */
export type StudentSourceType = 'system' | 'excel'

/**
 * 来源无关的最小学生结构。
 * 业务组件依赖该结构后，无需知道学生来自系统 Store 还是 Excel 行。
 */
export interface StudentSourceStudentType {
  /** 学生唯一标识 */
  id: string
  /** 学生姓名 */
  name: string
}

/** 可持久化到具体业务数据中的 Excel 名单快照。 */
export interface ExcelStudentSourceType {
  /** 名单文件名 */
  fileName: string
  /** 学生列表 */
  students: StudentSourceStudentType[]
}
