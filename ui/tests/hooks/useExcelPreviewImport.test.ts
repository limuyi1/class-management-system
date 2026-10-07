import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useExcelPreviewImport } from '../../src/hooks/useExcelPreviewImport'

/**
 * useExcelPreviewImport 组合式函数测试
 * 测试目标：学生名单类 Excel 导入的公共状态层
 * 覆盖功能：el-upload 与原生 File 双入口解析、空文件提示、失败提示、
 * 表头行切换后的数据派生、状态重置
 */

// xlsxUtil 替身：隔离真实 Excel 解析
const xlsxUtilMocks = vi.hoisted(() => ({
  parseExcelPreview: vi.fn(),
  buildExcelDataFromHeaderRow: vi.fn()
}))
vi.mock('@/utils/xlsxUtil', () => xlsxUtilMocks)

const messageMocks = vi.hoisted(() => ({
  warning: vi.fn(),
  error: vi.fn()
}))
vi.mock('element-plus', () => ({
  ElMessage: messageMocks
}))

describe('useExcelPreviewImport', () => {
  const previewResult = {
    rows: [['姓名', '语文'], ['张三', 90]],
    merges: [],
    suggestedHeaderRowIndex: 0
  }

  beforeEach(() => {
    xlsxUtilMocks.parseExcelPreview.mockReset()
    xlsxUtilMocks.buildExcelDataFromHeaderRow.mockReset()
    messageMocks.warning.mockReset()
    messageMocks.error.mockReset()
  })

  it('parses an el-upload file and exposes preview state', async () => {
    xlsxUtilMocks.parseExcelPreview.mockResolvedValue({
      ...previewResult,
      suggestedHeaderRowIndex: 1
    })
    const hook = useExcelPreviewImport()
    const rawFile = new File(['x'], '名单.xlsx')
    const uploadFile = { raw: rawFile, name: '名单.xlsx' }

    const success = await hook.parseFile(uploadFile as never)

    expect(success).toBe(true)
    expect(hook.preview.value?.rows).toEqual(previewResult.rows)
    expect(hook.sourceFile.value).toBe(rawFile)
    expect(hook.fileName.value).toBe('名单.xlsx')
    expect(hook.headerRowIndex.value).toBe(1)
  })

  it('warns and keeps empty state when the file has no data', async () => {
    xlsxUtilMocks.parseExcelPreview.mockResolvedValue({ rows: [], merges: [], suggestedHeaderRowIndex: 0 })
    const hook = useExcelPreviewImport()
    const uploadFile = { raw: new File(['x'], '空.xlsx'), name: '空.xlsx' }

    const success = await hook.parseFile(uploadFile as never)

    expect(success).toBe(false)
    expect(messageMocks.warning).toHaveBeenCalledWith('Excel 中没有可导入的数据')
    expect(hook.preview.value).toBeNull()
    expect(hook.fileName.value).toBe('')
  })

  it('shows an error message when parsing fails', async () => {
    xlsxUtilMocks.parseExcelPreview.mockRejectedValue(new Error('解析失败'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hook = useExcelPreviewImport({ errorLogLabel: '解析 Excel' })
    const uploadFile = { raw: new File(['x'], '坏.xlsx'), name: '坏.xlsx' }

    const success = await hook.parseFile(uploadFile as never)

    expect(success).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('解析 Excel失败:', expect.any(Error))
    expect(messageMocks.error).toHaveBeenCalledWith('Excel 读取失败，请检查文件格式')
    consoleSpy.mockRestore()
  })

  it('uses the custom error message when provided', async () => {
    xlsxUtilMocks.parseExcelPreview.mockRejectedValue(new Error('解析失败'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hook = useExcelPreviewImport({ errorMessage: '导入失败！' })
    const uploadFile = { raw: new File(['x'], '坏.xlsx'), name: '坏.xlsx' }

    await hook.parseFile(uploadFile as never)

    expect(messageMocks.error).toHaveBeenCalledWith('导入失败！')
    consoleSpy.mockRestore()
  })

  it('returns false without parsing when el-upload file has no raw file', async () => {
    const hook = useExcelPreviewImport()

    const success = await hook.parseFile({ raw: undefined } as never)

    expect(success).toBe(false)
    expect(xlsxUtilMocks.parseExcelPreview).not.toHaveBeenCalled()
  })

  it('supports the native File entry via parseRawFile', async () => {
    xlsxUtilMocks.parseExcelPreview.mockResolvedValue(previewResult)
    const hook = useExcelPreviewImport()
    const rawFile = new File(['x'], '名单.xlsx')

    const result = await hook.parseRawFile(rawFile)

    expect(result?.rows).toEqual(previewResult.rows)
    expect(hook.sourceFile.value).toBe(rawFile)
  })

  it('derives parsedData from the selected header row', () => {
    xlsxUtilMocks.buildExcelDataFromHeaderRow.mockReturnValue({
      header: ['姓名'],
      data: [{ 姓名: '张三' }]
    })
    const hook = useExcelPreviewImport()
    hook.preview.value = { ...previewResult, suggestedHeaderRowIndex: 0 }

    hook.headerRowIndex.value = 1
    const parsedData = hook.parsedData.value

    expect(xlsxUtilMocks.buildExcelDataFromHeaderRow).toHaveBeenCalledWith(previewResult.rows, 1)
    expect(parsedData).toEqual({ header: ['姓名'], data: [{ 姓名: '张三' }] })
  })

  it('returns empty parsedData without preview', () => {
    const hook = useExcelPreviewImport()

    expect(hook.parsedData.value).toEqual({ header: [], data: [] })
    expect(xlsxUtilMocks.buildExcelDataFromHeaderRow).not.toHaveBeenCalled()
  })

  it('resets all state', () => {
    xlsxUtilMocks.buildExcelDataFromHeaderRow.mockReturnValue({ header: [], data: [] })
    const hook = useExcelPreviewImport()
    hook.preview.value = previewResult
    hook.sourceFile.value = new File(['x'], 'a.xlsx')
    hook.fileName.value = 'a.xlsx'
    hook.loading.value = true
    hook.headerRowIndex.value = 2

    hook.reset()

    expect(hook.preview.value).toBeNull()
    expect(hook.sourceFile.value).toBeNull()
    expect(hook.fileName.value).toBe('')
    expect(hook.loading.value).toBe(false)
    expect(hook.headerRowIndex.value).toBe(0)
  })
})
