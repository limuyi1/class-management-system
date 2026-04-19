import type { StudentDataType } from '@/types/StudentData'

export interface PageInoType {
  pageWidth: number
  pageHeight: number
  cellWidth: number
  cellHeight: number
  columnCount: number
  margin: number
}

export interface EvaluationCardProps {
  pageInfo: PageInoType
  data: StudentDataType[]
  currentPage?: number
  totalPages?: number
}

export interface EvaluationCardEmits {
  click: [row: StudentDataType]
}
