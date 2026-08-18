/** 学生数据核心类型定义 */
import { NAME_PROP, STUDENT_ID_PROP } from '@/constants'

/**
 * 学生数据行类型
 * 支持动态扩展的属性（如各科成绩列），是系统最核心的数据类型
 */
export interface StudentDataType {
  /** 学生唯一标识 */
  [STUDENT_ID_PROP]: string
  /** 学生姓名（导入/录入时可暂为 null） */
  [NAME_PROP]: string | null
  /** 是否禁用（禁用后不参与统计和展示） */
  disabled?: boolean
  /** 期末评语 */
  comment?: string
  /** 标签数据，key 为标签分类 prop，value 为该分类下的标签数组 */
  tags?: Record<string, string[]>
  /** 动态扩展字段：支持各科成绩（number）、字符串值等 */
  [key: string]: string | number | boolean | undefined | null | Record<string, string[]>
}

/** 学生成绩条目，用于成绩导入和统计计算 */
export interface StudentScoreType {
  /** 分数值（null 表示未录入） */
  score: number | null
  /** 对应的学生数据 */
  student: StudentDataType
}
