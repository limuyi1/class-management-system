import type { StudentDataType } from '@/types/StudentData'
import type { ExcelCellValueType, ExcelMergeRangeType } from '@/utils/xlsxUtil'

/** 评语工作区数据来源：系统数据 或 外部 Excel */
export type CommentWorkspaceSourceType = 'system' | 'excel'

/** Excel 评语导入的列选择结果 */
export interface ExcelCommentImportSelectionType {
  /** 源 Excel 文件 */
  file: File
  /** 文件名 */
  fileName: string
  /** 解析后的行数据（二维数组） */
  rows: ExcelCellValueType[][]
  /** 合并单元格信息 */
  merges: ExcelMergeRangeType[]
  /** 用户选择的表头行索引 */
  headerRowIndex: number
  /** 姓名列标识 */
  nameColumn: string
  /** 评语列标识（可选） */
  commentColumn?: string
  /** 标签列标识（可选） */
  tagColumn?: string
}

/** Excel 评语工作区完整数据，扩展了导入选择结果 */
export interface ExcelCommentWorkspaceType extends ExcelCommentImportSelectionType {
  /** 匹配到的学生数据 */
  students: StudentDataType[]
  /** 因姓名为空而跳过的行数 */
  skippedEmptyNameCount: number
}
