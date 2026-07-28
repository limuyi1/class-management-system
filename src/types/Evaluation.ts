import type { StudentDataType } from '@/types/StudentData'

/** 评语页面布局信息（每页卡片行列数、边距等） */
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

/** 评语预览卡片组件 Props */
export interface EvaluationPreviewCardPropsType {
  pageInfo: EvaluationPageInfoType
  data: StudentDataType[]
  currentPage?: number
  totalPages?: number
  activeStudentId?: string
  suppressActiveState?: boolean
}

/** 评语预览卡片组件 Emits */
export interface EvaluationPreviewCardEmitsType {
  click: [row: StudentDataType]
}
