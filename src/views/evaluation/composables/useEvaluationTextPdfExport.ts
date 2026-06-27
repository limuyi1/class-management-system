import { ref, type Ref } from 'vue'
import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'

import { exportEvaluationTextExcel } from '@/utils/evaluationTextExcelUntil'
import { exportEvaluationTextPDF } from '@/utils/evaluationTextPdfUntil'
import { hasUnsupportedEvaluationHandwriteGlyphs } from '@/utils/evaluationHandwriteFontUntil'
import type { ConfigurationType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

interface UseEvaluationTextPdfExportOptions {
  enabledStudents: Ref<StudentDataType[]>
  configuration: ConfigurationType
}

export function useEvaluationTextPdfExport(options: UseEvaluationTextPdfExportOptions) {
  const textPdfExporting = ref(false)
  const textExcelExporting = ref(false)

  async function confirmUnsupportedGlyphs(): Promise<boolean> {
    try {
      const hasUnsupportedGlyphs = await hasUnsupportedEvaluationHandwriteGlyphs(
        options.enabledStudents.value,
        options.configuration
      )

      if (!hasUnsupportedGlyphs) return true

      await ElMessageBox.confirm(
        '当前手写字体可能无法显示部分字符，导出的 PDF 可能出现空白。是否继续导出？',
        '字体缺字提示',
        {
          confirmButtonText: '继续导出',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      return true
    } catch (error) {
      if (error === 'cancel' || error === 'close') return false
      console.error('检查手写字体字符覆盖失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '手写字体检查失败')
      return false
    }
  }

  async function handleExportTextPDF(): Promise<void> {
    if (!options.enabledStudents.value.length) {
      ElMessage.warning('没有可导出的学生期末评语')
      return
    }

    const shouldExport = await confirmUnsupportedGlyphs()
    if (!shouldExport) return

    textPdfExporting.value = true
    const loading = ElLoading.service({
      lock: true,
      text: '正在导出文字版PDF...'
    })

    try {
      const result = await exportEvaluationTextPDF({
        students: options.enabledStudents.value,
        configuration: options.configuration
      })

      if (!result.success) {
        ElMessage.error(result.error?.message || '导出失败！')
        return
      }

      ElMessage.success('评语导出成功')

      if (result.truncatedStudents.length > 0) {
        const previewNames = result.truncatedStudents.slice(0, 5).join('、')
        const suffix = result.truncatedStudents.length > 5 ? ' 等' : ''
        ElMessage.warning(
          `有 ${result.truncatedStudents.length} 条评语因内容过长被截断：${previewNames}${suffix}`
        )
      }
    } finally {
      loading.close()
      textPdfExporting.value = false
    }
  }

  async function handleExportTextExcel(): Promise<void> {
    if (!options.enabledStudents.value.length) {
      ElMessage.warning('没有可导出的学生期末评语')
      return
    }

    textExcelExporting.value = true
    const loading = ElLoading.service({
      lock: true,
      text: '正在导出评语Excel...'
    })

    try {
      const result = exportEvaluationTextExcel({
        students: options.enabledStudents.value
      })

      if (!result.success) {
        ElMessage.error(result.error?.message || '导出失败！')
        return
      }

      ElMessage.success('评语导出成功')
    } finally {
      loading.close()
      textExcelExporting.value = false
    }
  }

  return {
    handleExportTextExcel,
    handleExportTextPDF,
    textExcelExporting,
    textPdfExporting
  }
}
