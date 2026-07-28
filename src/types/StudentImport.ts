/** Excel 导入模式 */
export type ExcelImportModeType = 'initial' | 'score' | 'comment'

/** 评语导入策略：仅填充空值 / 覆盖已有内容 */
export type CommentImportStrategyType = 'fill-empty' | 'overwrite'

/** 初次导入时的列选择配置 */
export interface InitialImportSelectionType {
  /** 姓名列标识 */
  nameColumn: string
  /** 需要导入的成绩列列表 */
  scoreColumns: string[]
  /** 评语列标识（可选） */
  commentColumn?: string
}

/** 评语导入时的列选择配置 */
export interface CommentImportSelectionType {
  /** 姓名列标识 */
  nameColumn: string
  /** 评语列标识 */
  commentColumn: string
  /** 导入策略 */
  strategy: CommentImportStrategyType
}
