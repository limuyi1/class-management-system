/**
 * 评语 PDF 排版布局工具
 * 计算纸张尺寸、评语卡行列布局与分页坐标
 */
import { groupArray } from '@/utils/commonUtil'
import { NAME_PROP } from '@/constants'
import type {
  EvaluationPdfCellType,
  EvaluationPdfLayoutInputType,
  EvaluationPdfLayoutType,
  EvaluationPdfPageType
} from '@/types/EvaluationPdf'
import type { StudentDataType } from '@/types/StudentData'

/** 各纸张的毫米尺寸（纵向），用于评语 PDF 排版 */
const pageSizeMap = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  B3: { width: 353, height: 500 },
  B4: { width: 250, height: 353 }
} as const

/** 读取学生姓名，空值归一为空字符串 */
const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

/**
 * 获取指定纸张的毫米尺寸。
 * @param pageType - 纸张类型
 * @returns 宽高尺寸
 */
export const getPdfPageSize = (pageType: EvaluationPdfLayoutInputType['pageType']) => {
  return pageSizeMap[pageType]
}

/**
 * 根据纸张、评语卡尺寸、边距和对齐方式计算每页可容纳的行列及表格偏移。
 * @param input - 评语 PDF 布局输入参数
 * @returns 页面布局计算结果
 */
export const buildEvaluationPdfLayout = (
  input: EvaluationPdfLayoutInputType
): EvaluationPdfLayoutType => {
  const { width: pageWidth, height: pageHeight } = getPdfPageSize(input.pageType)
  const cellWidth = input.evaluationCardWidth
  const cellHeight = input.evaluationCardHeight
  const marginX = input.marginX
  const marginY = input.marginY

  const availableWidth = Math.max(pageWidth - marginX * 2, cellWidth)
  // 每行列数 = 可用宽度向下取整 ÷ 卡片宽度，至少 1 列
  const columnCount = Math.max(1, Math.floor(availableWidth / cellWidth))
  const tableWidth = cellWidth * columnCount
  // 三种对齐方式下表格左上角的 X 坐标
  const centeredOffset = Math.max(pageWidth - tableWidth, 0) / 2
  const leftAlignedOffset = Math.min(Math.max(marginX, 0), Math.max(pageWidth - tableWidth, 0))
  const rightAlignedOffset = Math.max(pageWidth - marginX - tableWidth, 0)

  let tableOffsetX = leftAlignedOffset
  if (input.evaluationTableAlign === 'center') {
    // 表格位置决定“目标对齐方式”，横向边距仅作为最小留白约束。
    // 这样两者不会互相叠加导致冲突，但边距过大时仍能限制最终位置。
    tableOffsetX = Math.min(Math.max(centeredOffset, leftAlignedOffset), rightAlignedOffset)
  } else if (input.evaluationTableAlign === 'right') {
    tableOffsetX = rightAlignedOffset
  }

  const availableHeight = Math.max(pageHeight - marginY * 2, cellHeight)
  // 每页行数 = 可用高度向下取整 ÷ 卡片高度，至少 1 行
  const rowCount = Math.max(1, Math.floor(availableHeight / cellHeight))
  // 每页可容纳的评语卡总数
  const pageCapacity = rowCount * columnCount

  return {
    pageWidth,
    pageHeight,
    cellWidth,
    cellHeight,
    columnCount,
    rowCount,
    marginX,
    marginY,
    tableWidth,
    tableOffsetX,
    pageCapacity
  }
}

/**
 * 将学生按每页容量分页，并计算每个评语格在页面内的坐标。
 * @param students - 学生列表
 * @param layout - 页面布局
 * @returns 分页后的页面数据
 */
export const paginateEvaluationStudents = (
  students: StudentDataType[],
  layout: EvaluationPdfLayoutType
): EvaluationPdfPageType[] => {
  const pages = groupArray(students, layout.pageCapacity)
  const totalPages = pages.length

  return pages.map((pageStudents, pageIndex) => {
    const cells: EvaluationPdfCellType[] = pageStudents.map((student, index) => {
      // 由页内线性序号换算行列位置
      const rowIndex = Math.floor(index / layout.columnCount)
      const columnIndex = index % layout.columnCount
      // 评语格左上角坐标 = 表格偏移 + 行列位置 × 卡片尺寸
      const x = layout.tableOffsetX + columnIndex * layout.cellWidth
      const y = layout.marginY + rowIndex * layout.cellHeight

      return {
        x,
        y,
        width: layout.cellWidth,
        height: layout.cellHeight,
        student,
        studentName: getStudentName(student),
        comment: student.comment?.trim() || ''
      }
    })

    return {
      pageNumber: pageIndex + 1,
      totalPages,
      cells
    }
  })
}
