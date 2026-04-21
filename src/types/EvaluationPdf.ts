import type { EvaluationTableAlignType, ConfigurationType } from '@/types/Configuration'
import type { PagesEnum } from '@/types/Common'
import type { StudentDataType } from '@/types/StudentData'

export interface EvaluationPdfLayoutInputType {
  pageType: PagesEnum
  evaluationCardWidth: number
  evaluationCardHeight: number
  marginX: number
  marginY: number
  evaluationTableAlign: EvaluationTableAlignType
}

export interface EvaluationPdfCellType {
  x: number
  y: number
  width: number
  height: number
  student: StudentDataType
  studentName: string
  comment: string
}

export interface EvaluationPdfPageType {
  pageNumber: number
  totalPages: number
  cells: EvaluationPdfCellType[]
}

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

export interface EvaluationTextPdfOptionsType {
  students: StudentDataType[]
  configuration: ConfigurationType
  fileName?: string
}

export interface EvaluationTextPdfResultType {
  success: boolean
  truncatedStudents: string[]
  error?: Error
}
