import { describe, expect, it } from 'vitest'

import { PagesEnum } from '@/types/Common'
import type { EvaluationPdfLayoutType } from '@/types/EvaluationPdf'
import type { StudentDataType } from '@/types/StudentData'

import {
  buildEvaluationPdfLayout,
  getPdfPageSize,
  paginateEvaluationStudents
} from '@/utils/evaluation/evaluationPdfLayoutUtil'

describe('getPdfPageSize', () => {
  it('返回指定纸张的毫米尺寸', () => {
    expect(getPdfPageSize(PagesEnum.A4)).toEqual({ width: 210, height: 297 })
    expect(getPdfPageSize(PagesEnum.A3)).toEqual({ width: 297, height: 420 })
  })
})

describe('buildEvaluationPdfLayout', () => {
  const baseInput = {
    pageType: PagesEnum.A4,
    evaluationCardWidth: 90,
    evaluationCardHeight: 69,
    marginX: 0,
    marginY: 0,
    evaluationTableAlign: 'left' as const
  }

  it('计算每页行列数与容量', () => {
    const layout = buildEvaluationPdfLayout(baseInput)

    expect(layout.columnCount).toBe(2)
    expect(layout.rowCount).toBe(4)
    expect(layout.pageCapacity).toBe(8)
    expect(layout.tableWidth).toBe(180)
  })

  it('左对齐时表格偏移为 0', () => {
    const layout = buildEvaluationPdfLayout(baseInput)
    expect(layout.tableOffsetX).toBe(0)
  })

  it('居中对齐时表格水平居中', () => {
    const layout = buildEvaluationPdfLayout({ ...baseInput, evaluationTableAlign: 'center' })
    expect(layout.tableOffsetX).toBe(15)
  })

  it('右对齐时表格靠右', () => {
    const layout = buildEvaluationPdfLayout({ ...baseInput, evaluationTableAlign: 'right' })
    expect(layout.tableOffsetX).toBe(30)
  })
})

describe('paginateEvaluationStudents', () => {
  const layout: EvaluationPdfLayoutType = {
    pageWidth: 210,
    pageHeight: 297,
    cellWidth: 90,
    cellHeight: 69,
    columnCount: 2,
    rowCount: 4,
    marginX: 0,
    marginY: 0,
    tableWidth: 180,
    tableOffsetX: 0,
    pageCapacity: 8
  }

  const students: StudentDataType[] = Array.from({ length: 10 }, (_, index) => ({
    studentId: `s${index}`,
    name: `学生${index}`,
    comment: ` 评语${index} `
  }))

  it('按每页容量分页并标注页码', () => {
    const pages = paginateEvaluationStudents(students, layout)

    expect(pages).toHaveLength(2)
    expect(pages[0].pageNumber).toBe(1)
    expect(pages[0].totalPages).toBe(2)
    expect(pages[0].cells).toHaveLength(8)
    expect(pages[1].cells).toHaveLength(2)
  })

  it('计算每个评语格坐标并清理评语空白', () => {
    const pages = paginateEvaluationStudents(students, layout)
    const cells = pages[0].cells

    expect(cells[0]).toMatchObject({ x: 0, y: 0, studentName: '学生0', comment: '评语0' })
    expect(cells[1]).toMatchObject({ x: 90, y: 0 })
    expect(cells[2]).toMatchObject({ x: 0, y: 69 })
  })
})
