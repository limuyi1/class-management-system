/**
 * 期末评语 Excel 导出工具
 * 将学生评语导出为便于二次编辑或归档的表格
 */
import { exportExcel } from '@/utils/xlsxUtil'
import { NAME_PROP } from '@/constants'
import type { StudentDataType } from '@/types/StudentData'

/** 期末评语 Excel 导出结果 */
export interface EvaluationTextExcelResultType {
  success: boolean
  error?: Error
}

/** 期末评语 Excel 导出参数 */
export interface EvaluationTextExcelOptionsType {
  students: StudentDataType[]
}

/** 将日期格式化为 YYYY-MM-DD，用于文件名 */
const formatDateForFileName = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * 导出期末评语 Excel，便于教师二次编辑或归档。
 * @param options - 导出参数（学生列表）
 * @returns 导出结果
 */
export const exportEvaluationTextExcel = (
  options: EvaluationTextExcelOptionsType
): EvaluationTextExcelResultType => {
  const headerData = ['序号', '姓名', '期末评语']
  const bodyData = options.students.map((student, index) => [
    index + 1,
    student[NAME_PROP] || '',
    student.comment?.trim() || ''
  ])

  return exportExcel(headerData, bodyData, `期末评语_${formatDateForFileName(new Date())}.xlsx`)
}
