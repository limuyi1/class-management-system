/**
 * evaluationTextExcelUtil 测试
 * 覆盖期末评语 Excel 导出（exportEvaluationTextExcel），
 * 其中 xlsxUtil 的 exportExcel 被 mock，验证表头、数据与文件名的组装。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// exportExcel 的 mock，用于捕获并断言导出调用参数
const exportExcelMock = vi.fn()

// mock xlsxUtil，避免测试中真实生成 Excel 文件
vi.mock('@/utils/xlsxUtil', () => ({
  exportExcel: (...args: unknown[]) => exportExcelMock(...args)
}))

import { exportEvaluationTextExcel } from '@/utils/evaluation/evaluationTextExcelUtil'

// 期末评语 Excel 导出：组装表头与数据并委托给 exportExcel
describe('exportEvaluationTextExcel', () => {
  // 每个用例前重置 mock 并预设导出成功，保证用例相互独立
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
