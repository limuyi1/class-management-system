import { beforeEach, describe, expect, it, vi } from 'vitest'

const exportExcelMock = vi.fn()

vi.mock('@/utils/xlsxUtil', () => ({
  exportExcel: (...args: unknown[]) => exportExcelMock(...args)
}))

import { exportEvaluationTextExcel } from '@/utils/evaluation/evaluationTextExcelUtil'

describe('exportEvaluationTextExcel', () => {
  beforeEach(() => {
    exportExcelMock.mockReset()
    exportExcelMock.mockReturnValue({ success: true })
  })

  it('构建表头与数据并委托给 exportExcel', () => {
    const students = [
      { studentId: '1', name: '张三', comment: ' 认真 ' },
      { studentId: '2', name: null, comment: undefined }
    ]

    const result = exportEvaluationTextExcel({ students })

    expect(exportExcelMock).toHaveBeenCalledTimes(1)

    const [header, body, fileName] = exportExcelMock.mock.calls[0] as [string[], unknown[], string]
    expect(header).toEqual(['序号', '姓名', '期末评语'])
    expect(body).toEqual([
      [1, '张三', '认真'],
      [2, '', '']
    ])
    expect(fileName).toMatch(/^期末评语_\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(result).toEqual({ success: true })
  })
})
