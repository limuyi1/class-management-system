/** 评语 PDF 导出相关的类型定义 */
import type { EvaluationTableAlignType, ConfigurationType } from '@/types/Configuration'
import type { PagesEnum } from '@/types/Common'
import type { StudentDataType } from '@/types/StudentData'

/** 评语 PDF 布局的输入参数 */
export interface EvaluationPdfLayoutInputType {
  /** 纸张类型 */
  pageType: PagesEnum
  /** 评语卡片宽度 */
  evaluationCardWidth: number
  /** 评语卡片高度 */
  evaluationCardHeight: number
  /** 页边距 X */
  marginX: number
  /** 页边距 Y */
  marginY: number
  /** 评语表格水平对齐方式 */
  evaluationTableAlign: EvaluationTableAlignType
}

/** PDF 页面中单个评语单元格的渲染信息 */
export interface EvaluationPdfCellType {
  /** 单元格在页面中的 X 坐标 */
  x: number
  /** 单元格在页面中的 Y 坐标 */
  y: number
  /** 单元格宽度 */
  width: number
  /** 单元格高度 */
  height: number
  /** 对应的学生数据 */
  student: StudentDataType
  /** 学生姓名 */
  studentName: string
  /** 评语内容 */
  comment: string
}

/** PDF 分页信息 */
export interface EvaluationPdfPageType {
  /** 页码（1 起始） */
  pageNumber: number
  /** 总页数 */
  totalPages: number
  /** 该页包含的评语单元格 */
  cells: EvaluationPdfCellType[]
}

/** PDF 布局计算结果 */
export interface EvaluationPdfLayoutType {
  /** 页面宽度 */
  pageWidth: number
  /** 页面高度 */
  pageHeight: number
  /** 单个单元格宽度 */
  cellWidth: number
  /** 单个单元格高度 */
  cellHeight: number
  /** 每行列数 */
  columnCount: number
  /** 每页行数 */
  rowCount: number
  /** 页边距 X */
  marginX: number
  /** 页边距 Y */
  marginY: number
  /** 表格整体宽度 */
  tableWidth: number
  /** 表格水平偏移量 */
  tableOffsetX: number
  /** 每页可容纳的单元格数量 */
  pageCapacity: number
}

/** 纯文本评语 PDF 导出选项 */
export interface EvaluationTextPdfOptionsType {
  /** 待导出的学生列表 */
  students: StudentDataType[]
  /** 应用配置 */
  configuration: ConfigurationType
  /** 导出文件名 */
  fileName?: string
}

/** 纯文本评语 PDF 导出结果 */
export interface EvaluationTextPdfResultType {
  /** 是否导出成功 */
  success: boolean
  /** 评语被截断的学生姓名列表 */
  truncatedStudents: string[]
  /** 导出失败时的错误对象 */
  error?: Error
}
