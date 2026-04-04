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
  data: Array<any>
  currentPage?: number
  totalPages?: number
}

export interface EvaluationCardEmits {
  click: [row: any]
}
