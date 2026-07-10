import type { StudentDataType } from '@/types/StudentData'

export interface EvaluationPageInfoType {
  pageWidth: number
  pageHeight: number
  cellWidth: number
  cellHeight: number
  columnCount: number
  marginX: number
  marginY: number
  tableWidth: number
  tableOffsetX: number
}

export interface EvaluationPreviewCardPropsType {
  pageInfo: EvaluationPageInfoType
  data: StudentDataType[]
  currentPage?: number
  totalPages?: number
  activeStudentId?: string
  suppressActiveState?: boolean
}

export interface EvaluationPreviewCardEmitsType {
  click: [row: StudentDataType]
}
