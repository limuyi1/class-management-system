import * as XLSX from 'xlsx'
import domtoimage from 'dom-to-image'
import type { UploadFile } from 'element-plus'

interface OperationResultType {
  success: boolean
  error?: Error
}

type ExcelCellValueType = string | number | boolean | null | undefined
type ExcelRowType = Record<string, ExcelCellValueType>

interface ExcelMergeRangeType {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

interface ExcelPreviewResultType {
  rows: ExcelCellValueType[][]
  merges: ExcelMergeRangeType[]
  suggestedHeaderRowIndex: number
}

const EXCEL_PREVIEW_ROW_COUNT = 8
const NAME_HEADER_PATTERNS = ['姓名', '学生姓名', '学生', '名字']

/**
 * 将表格数据导出为图片
 * @param data - 二维数组，第一行为表头，后续为数据行
 * @param imageName - 导出图片的文件名，默认 image.png
 * @param scale - 缩放比例，默认 2（提高清晰度）
 */
const xlsxToImage = async (
  data: ExcelCellValueType[][],
  imageName: string = 'image.png',
  scale: number = 2
): Promise<OperationResultType> => {
  const element = document.createElement('div')
  element.id = 'sheet'
  element.setAttribute('style', 'position: absolute;top: 0;z-index: -1000;')
  document.body.appendChild(element)

  try {
    const worksheet = XLSX.utils.aoa_to_sheet(data)
    element.innerHTML = XLSX.utils.sheet_to_html(worksheet)

    const selectorTable = element.querySelector('table')
    selectorTable?.setAttribute('border', '1')
    selectorTable?.setAttribute('cellspacing', '0')

    const dataUrl = await domtoimage.toJpeg(element, {
      quality: 1,
      width: element?.offsetWidth * scale,
      height: element?.offsetHeight * scale,
      bgcolor: '#FFFFFF',
      style: {
        transform: `scale(${scale})`,
        transformOrigin: '0 0'
      }
    })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = imageName
    link.click()
    return { success: true }
  } catch (error) {
    const resultError = error instanceof Error ? error : new Error('导出图片失败')
    console.error('导出图片失败:', resultError)
    return { success: false, error: resultError }
  } finally {
    element.remove()
  }
}

/**
 * 导出 Excel 文件
 * @param headerData - 表头数组，如 ['序号', '姓名', '分数']
 * @param bodyData - 数据二维数组
 * @param fileName - 文件名，默认当前日期时间
 * @param file - 预构建的工作簿对象，用于多 sheet 导出
 */
const exportExcel = (
  headerData?: string[],
  bodyData?: ExcelCellValueType[][],
  fileName: string = new Date().toLocaleString() + '.xlsx',
  file?: XLSX.WorkBook
): OperationResultType => {
  try {
    let workbook
    if (!file && headerData && bodyData) {
      workbook = XLSX.utils.book_new()
      const data = [headerData, ...bodyData]
      const worksheet = XLSX.utils.aoa_to_sheet(data)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
    } else {
      workbook = file
    }

    if (!workbook) {
      return { success: false, error: new Error('导出Excel失败：工作簿为空') }
    }

    const excelBuffer = XLSX.write(workbook!, {
      bookType: 'xlsx',
      type: 'array'
    })

    const blobData = new Blob([excelBuffer], { type: 'application/octet-stream' })
    const url = window.URL.createObjectURL(blobData)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    link.click()

    window.URL.revokeObjectURL(url)
    return { success: true }
  } catch (error) {
    const resultError = error instanceof Error ? error : new Error('导出Excel失败')
    console.error('导出Excel失败:', resultError)
    return { success: false, error: resultError }
  }
}

/**
 * 使用 FileReader 读取上传的 Excel 文件内容。
 * 后续预览和正式解析共用同一个二进制读取入口，避免两套读取逻辑出现差异。
 */
const readExcelBinary = async (file: UploadFile): Promise<string> => {
  const rawFile = file.raw
  if (!rawFile) {
    throw new Error('文件内容为空')
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsBinaryString(rawFile)
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const result = event.target?.result
      if (typeof result !== 'string') {
        reject(new Error('读取文件失败'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => {
      reject(new Error('读取文件失败'))
    }
  })
}

const readFirstWorksheet = async (file: UploadFile): Promise<XLSX.WorkSheet> => {
  const dataBinary = await readExcelBinary(file)
  const workBook = XLSX.read(dataBinary, { type: 'binary', cellDates: true })
  return workBook.Sheets[workBook.SheetNames[0]]
}

const normalizeCellValue = (value: ExcelCellValueType): ExcelCellValueType => {
  if (typeof value !== 'string') return value
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

const readWorksheetRows = (sheet: XLSX.WorkSheet): ExcelCellValueType[][] => {
  return XLSX.utils
    .sheet_to_json<ExcelCellValueType[]>(sheet, {
      header: 1,
      defval: null,
      raw: false
    })
    .map((row) => row.map(normalizeCellValue))
}

const readWorksheetMerges = (sheet: XLSX.WorkSheet): ExcelMergeRangeType[] => {
  return (sheet['!merges'] ?? []).map((merge) => ({
    startRow: merge.s.r,
    startColumn: merge.s.c,
    endRow: merge.e.r,
    endColumn: merge.e.c
  }))
}

const getNonEmptyCellCount = (row: ExcelCellValueType[]): number => {
  return row.filter((cell) => cell !== null && cell !== undefined && cell !== '').length
}

const rowContainsNameHeader = (row: ExcelCellValueType[]): boolean => {
  return row.some((cell) => {
    if (cell === null || cell === undefined) return false
    const text = String(cell).trim()
    return NAME_HEADER_PATTERNS.some((pattern) => text.includes(pattern))
  })
}

/**
 * 猜测最可能的表头行：优先选择包含“姓名/学生姓名”等字段的行；
 * 若没有明显姓名字段，则选择前 8 行中非空单元格最多的行，用户仍可在预览弹窗中手动修正。
 */
const guessHeaderRowIndex = (rows: ExcelCellValueType[][]): number => {
  const previewRows = rows.slice(0, EXCEL_PREVIEW_ROW_COUNT)
  const nameRowIndex = previewRows.findIndex(rowContainsNameHeader)
  if (nameRowIndex >= 0) return nameRowIndex

  return previewRows.reduce(
    (bestIndex, row, index) => {
      const currentCount = getNonEmptyCellCount(row)
      const bestCount = getNonEmptyCellCount(previewRows[bestIndex] || [])
      return currentCount > bestCount ? index : bestIndex
    },
    0
  )
}

/**
 * 读取 Excel 预览数据。这里只保留原始行列结构，让用户确认哪一行才是真正表头。
 */
const parseExcelPreview = async (file: UploadFile): Promise<ExcelPreviewResultType> => {
  const firstWorkSheet = await readFirstWorksheet(file)
  const rows = readWorksheetRows(firstWorkSheet)

  return {
    rows,
    merges: readWorksheetMerges(firstWorkSheet),
    suggestedHeaderRowIndex: guessHeaderRowIndex(rows)
  }
}

const createFallbackHeader = (columnIndex: number): string => `UNKNOWN ${columnIndex}`

/**
 * 根据用户确认的表头行生成业务导入需要的 header/data。
 * 本函数只使用被选中的单行作为字段名，不拼接上级表头；复杂或重复表头由用户整理 Excel 后再导入。
 */
const buildExcelDataFromHeaderRow = (
  rows: ExcelCellValueType[][],
  headerRowIndex: number
): { header: string[]; data: ExcelRowType[] } => {
  const headerRow = rows[headerRowIndex] || []
  const header = headerRow.map((cell, index) => {
    const value = normalizeCellValue(cell)
    return value === null || value === undefined ? createFallbackHeader(index) : String(value)
  })

  const data = rows
    .slice(headerRowIndex + 1)
    .filter((row) => getNonEmptyCellCount(row) > 0)
    .map((row) =>
      header.reduce((acc, column, index) => {
        acc[column] = normalizeCellValue(row[index] ?? null)
        return acc
      }, {} as ExcelRowType)
    )

  return { header, data }
}

/**
 * 解析 Excel 文件。
 * 默认使用自动猜测出的表头行；需要用户确认表头行的导入流程应先调用 parseExcelPreview。
 */
const parseExcel = async (
  file: UploadFile
): Promise<{ header: string[]; data: ExcelRowType[] }> => {
  const preview = await parseExcelPreview(file)
  return buildExcelDataFromHeaderRow(preview.rows, preview.suggestedHeaderRowIndex)
}

export { buildExcelDataFromHeaderRow, exportExcel, parseExcel, parseExcelPreview, xlsxToImage }
export type { ExcelCellValueType, ExcelMergeRangeType, ExcelPreviewResultType, ExcelRowType }
