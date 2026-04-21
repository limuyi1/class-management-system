import type { StudentDataType } from '@/types/StudentData'

export interface PageInoType {
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

export interface EvaluationCardProps {
  pageInfo: PageInoType
  data: StudentDataType[]
  currentPage?: number
  totalPages?: number
  activeStudentName?: string
  suppressActiveState?: boolean
}

export interface EvaluationCardEmits {
  click: [row: StudentDataType]
}
