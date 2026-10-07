/** 报告计算使用归一化后的纯数据，不依赖浏览器 Store。 */
export interface ReportStudentType {
  studentId: string
  name: string
  tags?: Record<string, string[]>
  [key: string]: unknown
}
export interface ReportColumnType {
  prop: string
  label: string
}
export interface ReportTagCategoryType {
  prop: string
}
