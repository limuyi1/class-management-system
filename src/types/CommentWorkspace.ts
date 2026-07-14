import type { StudentDataType } from '@/types/StudentData'
import type { ExcelCellValueType, ExcelMergeRangeType } from '@/utils/xlsxUntil'

export type CommentWorkspaceSourceType = 'system' | 'excel'

export interface ExcelCommentImportSelectionType {
  file: File
  fileName: string
  rows: ExcelCellValueType[][]
  merges: ExcelMergeRangeType[]
  headerRowIndex: number
  nameColumn: string
  commentColumn?: string
  tagColumn?: string
}

export interface ExcelCommentWorkspaceType extends ExcelCommentImportSelectionType {
  students: StudentDataType[]
  skippedEmptyNameCount: number
}
