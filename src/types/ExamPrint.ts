/** 单次测评的统计结果，分数保持原满分，分段按百分制判断。 */
export interface ExamPrintAnalysisType {
  total: number
  valid: number
  /** 包含未录入、非数值及超出满分范围的成绩，不推断为缺考 */
  missing: number
  fullMark: number
  average: number | null
  /** 无有效成绩时为 null；比例使用 0-100 的百分数 */
  passRate: number | null
  excellentRate: number | null
  bands: Array<{ label: string; count: number }>
  students: Array<{ id: string; name: string; score: number | null }>
}

/** 摘要与明细共用页模型，分页不产生 Canvas。 */
export interface ExamPrintPageType {
  kind: 'summary' | 'students'
  page: number
  pageCount: number
  rows: Array<ExamPrintAnalysisType['students'][number] & { number: number }>
}
