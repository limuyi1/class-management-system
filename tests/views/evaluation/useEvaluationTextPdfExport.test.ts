import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEvaluationTextPdfExport } from '@/views/evaluation/composables/useEvaluationTextPdfExport'
import { PagesEnum } from '@/types/Common'
import type { ConfigurationType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

const fontUtilMocks = vi.hoisted(() => ({
  hasUnsupportedEvaluationHandwriteGlyphs: vi.fn()
}))

const exportMocks = vi.hoisted(() => ({
  exportEvaluationTextExcel: vi.fn(),
  exportEvaluationTextPDF: vi.fn()
}))

const loadingMocks = vi.hoisted(() => ({
  close: vi.fn()
}))

const messageBoxMocks = vi.hoisted(() => ({
  confirm: vi.fn()
}))

const messageMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn()
}))

vi.mock('@/utils/evaluation/evaluationHandwriteFontUtil', () => fontUtilMocks)
vi.mock('@/utils/evaluation/evaluationTextExcelUtil', () => exportMocks)
vi.mock('@/utils/evaluation/evaluationTextPdfUtil', () => exportMocks)

vi.mock('element-plus', () => ({
  ElLoading: {
    service: vi.fn(() => loadingMocks)
  },
  ElMessage: messageMocks,
  ElMessageBox: messageBoxMocks
}))

const createConfiguration = (): ConfigurationType => ({
  fontSize: 18,
  salutationFontSize: 18,
  textFontSize: 18,
  sealFontSize: 18,
  classTeacherFontSize: 18,
  inscribeFontSize: 18,
  inscribe: '',
  showEvaluationPageNumber: true,
  pageType: PagesEnum.A4,
  pageTypeList: [PagesEnum.A4],
  evaluationCardWidth: 90,
  evaluationCardHeight: 69,
  marginX: 15,
  marginY: 7.5,
  evaluationTableAlign: 'left',
  previewMode: '100',
  inputScoreTab: null,
  recentScoreEntries: {},
  scoreImageCompressRatio: 0.6,
  evaluationHandwriteFont: null
})

const createStudent = (name: string): StudentDataType => ({
  name: name,
  comment: '评语'
})

describe('useEvaluationTextPdfExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fontUtilMocks.hasUnsupportedEvaluationHandwriteGlyphs.mockResolvedValue(false)
    exportMocks.exportEvaluationTextPDF.mockResolvedValue({
      success: true,
      truncatedStudents: []
    })
    exportMocks.exportEvaluationTextExcel.mockReturnValue({
      success: true
    })
    messageBoxMocks.confirm.mockResolvedValue('confirm')
  })

  it('should warn when there are no enabled students to export', async () => {
    const hook = useEvaluationTextPdfExport({
      enabledStudents: ref([]),
      configuration: createConfiguration()
    })

    await hook.handleExportTextPDF()

    expect(messageMocks.warning).toHaveBeenCalledWith('没有可导出的学生期末评语')
    expect(exportMocks.exportEvaluationTextPDF).not.toHaveBeenCalled()
  })

  it('should stop export when unsupported glyph confirmation is cancelled', async () => {
    fontUtilMocks.hasUnsupportedEvaluationHandwriteGlyphs.mockResolvedValue(true)
    messageBoxMocks.confirm.mockRejectedValue('cancel')
    const hook = useEvaluationTextPdfExport({
      enabledStudents: ref([createStudent('张三')]),
      configuration: createConfiguration()
    })

    await hook.handleExportTextPDF()

    expect(messageBoxMocks.confirm).toHaveBeenCalled()
    expect(exportMocks.exportEvaluationTextPDF).not.toHaveBeenCalled()
  })

  it('should export and warn when long comments are truncated', async () => {
    exportMocks.exportEvaluationTextPDF.mockResolvedValue({
      success: true,
      truncatedStudents: ['张三', '李四']
    })
    const students = ref([createStudent('张三')])
    const configuration = createConfiguration()
    const hook = useEvaluationTextPdfExport({
      enabledStudents: students,
      configuration
    })

    await hook.handleExportTextPDF()

    expect(exportMocks.exportEvaluationTextPDF).toHaveBeenCalledWith({
      students: students.value,
      configuration
    })
    expect(messageMocks.success).toHaveBeenCalledWith('评语导出成功')
    expect(messageMocks.warning).toHaveBeenCalledWith(
      '有 2 条评语因内容过长被截断：张三、李四'
    )
    expect(loadingMocks.close).toHaveBeenCalled()
    expect(hook.textPdfExporting.value).toBe(false)
  })

  it('should warn when there are no enabled students to export as Excel', async () => {
    const hook = useEvaluationTextPdfExport({
      enabledStudents: ref([]),
      configuration: createConfiguration()
    })

    await hook.handleExportTextExcel()

    expect(messageMocks.warning).toHaveBeenCalledWith('没有可导出的学生期末评语')
    expect(exportMocks.exportEvaluationTextExcel).not.toHaveBeenCalled()
  })

  it('should export comments as Excel', async () => {
    const students = ref([createStudent('张三')])
    const hook = useEvaluationTextPdfExport({
      enabledStudents: students,
      configuration: createConfiguration()
    })

    await hook.handleExportTextExcel()

    expect(exportMocks.exportEvaluationTextExcel).toHaveBeenCalledWith({
      students: students.value
    })
    expect(messageMocks.success).toHaveBeenCalledWith('评语导出成功')
    expect(loadingMocks.close).toHaveBeenCalled()
    expect(hook.textExcelExporting.value).toBe(false)
  })

  it('should show Excel export error message when export fails', async () => {
    exportMocks.exportEvaluationTextExcel.mockReturnValue({
      success: false,
      error: new Error('Excel 导出失败')
    })
    const hook = useEvaluationTextPdfExport({
      enabledStudents: ref([createStudent('张三')]),
      configuration: createConfiguration()
    })

    await hook.handleExportTextExcel()

    expect(messageMocks.error).toHaveBeenCalledWith('Excel 导出失败')
    expect(loadingMocks.close).toHaveBeenCalled()
    expect(hook.textExcelExporting.value).toBe(false)
  })
})
