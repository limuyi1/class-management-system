import { computed, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'

import { buildExcelDataFromHeaderRow, parseExcelPreview } from '@/utils/xlsxUtil'

import type { UploadFile } from 'element-plus'
import type { ExcelPreviewResultType } from '@/utils/xlsxUtil'

interface UseExcelPreviewImportOptionsType {
  /** 控制台错误上下文，便于区分是哪个业务入口读取失败。 */
  errorLogLabel?: string
  /** 面向用户的解析失败提示；不传时使用公共默认文案。 */
  errorMessage?: string
}

/**
 * 学生名单类 Excel 导入的公共状态层。
 *
 * 统一负责：文件解析、空文件校验、loading、原始预览、推荐表头行、表头切换后的行数据转换和重置。
 * 不负责：姓名/成绩/评语等业务列校验，也不写入任何 Pinia Store。
 *
 * - Element Plus el-upload 使用 parseFile。
 * - 原生 input[type=file]（例如同时支持 .dexie 的设置页）使用 parseRawFile。
 */
export function useExcelPreviewImport(options: UseExcelPreviewImportOptionsType = {}) {
  const preview = shallowRef<ExcelPreviewResultType | null>(null)
  const sourceFile = shallowRef<File | null>(null)
  const fileName = shallowRef('')
  const loading = shallowRef(false)
  const headerRowIndex = shallowRef(0)

  /** 根据当前表头行索引解析出的表头与数据行 */
  const parsedData = computed(() => {
    if (!preview.value) return { header: [], data: [] }
    return buildExcelDataFromHeaderRow(preview.value.rows, headerRowIndex.value)
  })

  /** 重置解析状态 */
  const reset = (): void => {
    preview.value = null
    sourceFile.value = null
    fileName.value = ''
    loading.value = false
    headerRowIndex.value = 0
  }

  /** 解析 Excel 文件，失败时弹窗提示并返回 null */
  const parseSourceFile = async (
    uploadFile: UploadFile,
    rawFile: File,
    nextFileName: string
  ): Promise<ExcelPreviewResultType | null> => {
    loading.value = true
    try {
      const nextPreview = await parseExcelPreview(uploadFile)
      if (!nextPreview.rows.length) {
        ElMessage.warning('Excel 中没有可导入的数据')
        return null
      }

      preview.value = nextPreview
      sourceFile.value = rawFile
      fileName.value = nextFileName
      headerRowIndex.value = nextPreview.suggestedHeaderRowIndex
      return nextPreview
    } catch (error) {
      console.error(`${options.errorLogLabel || '读取 Excel'}失败:`, error)
      ElMessage.error(options.errorMessage || 'Excel 读取失败，请检查文件格式')
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * el-upload 文件解析入口
   * @param file - Element Plus 上传文件对象
   * @returns 是否解析成功
   */
  const parseFile = async (file: UploadFile): Promise<boolean> => {
    if (!file.raw) return false
    return Boolean(await parseSourceFile(file, file.raw, file.name))
  }

  /**
   * 让原生 File 入口复用与 el-upload 完全相同的解析和错误处理。
   * @param file - 原始 File 对象
   * @returns 解析结果，空文件或失败返回 null
   */
  const parseRawFile = async (file: File): Promise<ExcelPreviewResultType | null> =>
    parseSourceFile({ raw: file, name: file.name } as UploadFile, file, file.name)

  return {
    fileName,
    headerRowIndex,
    loading,
    parsedData,
    preview,
    sourceFile,
    parseFile,
    parseRawFile,
    reset
  }
}
