import type { EvaluationTableAlignType, ConfigurationType } from '@/types/Configuration'
import type { PagesEnum } from '@/types/Common'
import type { StudentDataType } from '@/types/StudentData'

/** 评语 PDF 布局的输入参数 */
export interface EvaluationPdfLayoutInputType {
  pageType: PagesEnum
  evaluationCardWidth: number
  evaluationCardHeight: number
  marginX: number
  marginY: number
  evaluationTableAlign: EvaluationTableAlignType
}

/** PDF 页面中单个评语单元格的渲染信息 */
export interface EvaluationPdfCellType {
  x: number
  y: number
  width: number
  height: number
  student: StudentDataType
  studentName: string
  comment: string
}

/** PDF 分页信息 */
export interface EvaluationPdfPageType {
  pageNumber: number
  totalPages: number
  cells: EvaluationPdfCellType[]
}

/** PDF 布局计算结果 */
export interface EvaluationPdfLayoutType {
  pageWidth: number
  pageHeight: number
  cellWidth: number
  cellHeight: number
  columnCount: number
  rowCount: number
  marginX: number
  marginY: number
  tableWidth: number
  tableOffsetX: number
  pageCapacity: number
}

/** 纯文本评语 PDF 导出选项 */
export interface EvaluationTextPdfOptionsType {
  students: StudentDataType[]
  configuration: ConfigurationType
  fileName?: string
}

/** 纯文本评语 PDF 导出结果 */
export interface EvaluationTextPdfResultType {
  success: boolean
  truncatedStudents: string[]
  error?: Error
}
