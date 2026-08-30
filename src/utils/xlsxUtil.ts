/**
 * Excel 解析与导出工具
 * 提供表格数据导出为 Excel/图片，以及上传 Excel 的预览与解析能力
 */
import * as XLSX from 'xlsx'
import domtoimage from 'dom-to-image'
import type { UploadFile } from 'element-plus'

/** 通用操作结果：success 标识是否成功，失败时携带 error */
interface OperationResultType {
  success: boolean
  error?: Error
}

/** Excel 单元格值，允许空值以区分空单元格 */
type ExcelCellValueType = string | number | boolean | null | undefined
/** 以表头字段为 key 的 Excel 数据行 */
type ExcelRowType = Record<string, ExcelCellValueType>

/** 合并单元格范围（行列序号均从 0 开始） */
interface ExcelMergeRangeType {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

/** Excel 预览结果：原始行列结构、合并区域和建议表头行 */
interface ExcelPreviewResultType {
  rows: ExcelCellValueType[][]
  merges: ExcelMergeRangeType[]
  suggestedHeaderRowIndex: number
}

/** 预览时最多扫描的前 N 行，用于猜测表头位置 */
const EXCEL_PREVIEW_ROW_COUNT = 8
/** 用于识别表头行的姓名字段关键词 */
const NAME_HEADER_PATTERNS = ['姓名', '学生姓名', '学生', '名字']

/**
 * 将表格数据导出为图片
 * @param data - 二维数组，第一行为表头，后续为数据行
 * @param imageName - 导出图片的文件名，默认 image.png
 * @param scale - 缩放比例，默认 2（提高清晰度）
 * @returns 操作结果，success 标识是否成功，失败时携带 error
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
 * @returns 操作结果，success 标识是否成功，失败时携带 error
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
 * @param file - 上传的 Excel 文件
 * @returns 文件二进制内容字符串
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

/**
 * 读取上传文件中的第一个工作表。
 * @param file - 上传的 Excel 文件
 * @returns 第一个工作表对象
 */
const readFirstWorksheet = async (file: UploadFile): Promise<XLSX.WorkSheet> => {
  const dataBinary = await readExcelBinary(file)
  const workBook = XLSX.read(dataBinary, { type: 'binary', cellDates: true })
  return workBook.Sheets[workBook.SheetNames[0]]
}

/**
 * 规范化单元格值：字符串去除首尾空格，空字符串归一为 null。
 * @param value - 原始单元格值
 * @returns 规范化后的值
 */
const normalizeCellValue = (value: ExcelCellValueType): ExcelCellValueType => {
  if (typeof value !== 'string') return value
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

/**
 * 读取工作表的二维行数据，空单元格用 null 占位，不做格式转换。
 * @param sheet - 工作表对象
 * @returns 二维单元格数组
 */
const readWorksheetRows = (sheet: XLSX.WorkSheet): ExcelCellValueType[][] => {
  return XLSX.utils
    .sheet_to_json<ExcelCellValueType[]>(sheet, {
      header: 1,
      defval: null,
      raw: false
    })
    .map((row) => row.map(normalizeCellValue))
}

/**
 * 提取工作表的合并单元格范围，统一转为行列序号。
 * @param sheet - 工作表对象
 * @returns 合并范围数组
 */
const readWorksheetMerges = (sheet: XLSX.WorkSheet): ExcelMergeRangeType[] => {
  return (sheet['!merges'] ?? []).map((merge) => ({
    startRow: merge.s.r,
    startColumn: merge.s.c,
    endRow: merge.e.r,
    endColumn: merge.e.c
  }))
}

/** 统计一行中非空单元格的数量 */
const getNonEmptyCellCount = (row: ExcelCellValueType[]): number => {
  return row.filter((cell) => cell !== null && cell !== undefined && cell !== '').length
}

/** 判断一行是否包含姓名类表头字段 */
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
 * @param rows - 二维单元格数组
 * @returns 猜测出的表头行下标
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
 * @param file - 上传的 Excel 文件
 * @returns 预览结果（原始行列结构、合并区域和建议表头行）
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

/** 为无法解析出名称的表头列生成占位名称 */
const createFallbackHeader = (columnIndex: number): string => `UNKNOWN ${columnIndex}`

/**
 * 根据用户确认的表头行生成业务导入需要的 header/data。
 * 本函数只使用被选中的单行作为字段名，不拼接上级表头；复杂或重复表头由用户整理 Excel 后再导入。
 * @param rows - 二维单元格数组
 * @param headerRowIndex - 用户确认的表头行下标
 * @returns 表头数组与以表头为 key 的数据行数组
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
 * @param file - 上传的 Excel 文件
 * @returns 表头数组与以表头为 key 的数据行数组
 */
const parseExcel = async (
  file: UploadFile
): Promise<{ header: string[]; data: ExcelRowType[] }> => {
  const preview = await parseExcelPreview(file)
  return buildExcelDataFromHeaderRow(preview.rows, preview.suggestedHeaderRowIndex)
}

export { buildExcelDataFromHeaderRow, exportExcel, parseExcel, parseExcelPreview, xlsxToImage }
export type { ExcelCellValueType, ExcelMergeRangeType, ExcelPreviewResultType, ExcelRowType }
