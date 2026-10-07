/** 评语页面相关的类型定义 */
import type { StudentDataType } from '@/types/StudentData'

/** 评语页面布局信息（每页卡片行列数、边距等） */
export interface EvaluationPageInfoType {
  /** 页面宽度 */
  pageWidth: number
  /** 页面高度 */
  pageHeight: number
  /** 单个评语单元格宽度 */
  cellWidth: number
  /** 单个评语单元格高度 */
  cellHeight: number
  /** 每行列数 */
  columnCount: number
  /** 页边距 X */
  marginX: number
  /** 页边距 Y */
  marginY: number
  /** 表格整体宽度 */
  tableWidth: number
  /** 表格水平偏移量 */
  tableOffsetX: number
}

/** 评语预览卡片组件 Props */
export interface EvaluationPreviewCardPropsType {
  /** 页面布局信息 */
  pageInfo: EvaluationPageInfoType
  /** 当前页的学生数据 */
  data: StudentDataType[]
  /** 当前页码（1 起始） */
  currentPage?: number
  /** 总页数 */
  totalPages?: number
  /** 当前高亮的学生 ID */
  activeStudentId?: string
  /** 是否抑制高亮选中态 */
  suppressActiveState?: boolean
}

/** 评语预览卡片组件 Emits */
export interface EvaluationPreviewCardEmitsType {
  /** 点击某个学生卡片 */
  click: [row: StudentDataType]
}
