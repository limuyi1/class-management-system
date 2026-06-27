import { exportExcel } from '@/utils/xlsxUntil'
import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

export interface EvaluationTextExcelResultType {
  success: boolean
  error?: Error
}

export interface EvaluationTextExcelOptionsType {
  students: StudentDataType[]
}

const formatDateForFileName = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * 导出期末评语 Excel，便于教师二次编辑或归档。
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
