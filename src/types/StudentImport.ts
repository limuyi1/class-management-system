export type ExcelImportModeType = 'initial' | 'score' | 'comment'

export type CommentImportStrategyType = 'fill-empty' | 'overwrite'

export interface InitialImportSelectionType {
  nameColumn: string
  scoreColumns: string[]
  commentColumn?: string
}

export interface CommentImportSelectionType {
  nameColumn: string
  commentColumn: string
  strategy: CommentImportStrategyType
}
