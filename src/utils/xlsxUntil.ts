import * as XLSX from 'xlsx'
import domtoimage from 'dom-to-image'
import type { UploadFile } from 'element-plus'

interface OperationResultType {
  success: boolean
  error?: Error
}

type ExcelCellValueType = string | number | boolean | null | undefined

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
 * 解析 Excel 文件
 * @param file - 文件对象，来自 el-upload 的 file.raw
 * @returns 包含 header（表头数组）和 data（数据数组）的对象
 */
type ExcelRowType = Record<string, string | number | boolean | null | undefined>

const parseExcel = async (
  file: UploadFile
): Promise<{ header: string[]; data: ExcelRowType[] }> => {
  const rawFile = file.raw
  if (!rawFile) {
    throw new Error('文件内容为空')
  }

  const dataBinary = await new Promise<string>((resolve, reject) => {
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

  const workBook = XLSX.read(dataBinary, { type: 'binary', cellDates: true })
  const firstWorkSheet = workBook.Sheets[workBook.SheetNames[0]]

  const header = getRow(firstWorkSheet)
  const data = XLSX.utils.sheet_to_json<ExcelRowType>(firstWorkSheet)

  return { header, data }
}

/**
 * 读取工作表指定行的数据
 * @param sheet - 工作表对象
 * @param row - 行索引，默认 0（第一行，表头行）
 * @returns 该行的数据数组
 */
const getRow = (sheet: XLSX.WorkSheet, row?: number) => {
  const headers: string[] = []
  const ref = sheet['!ref']
  if (!ref) return headers
  const range = XLSX.utils.decode_range(ref)
  let C: number
  const R = row ? row : range.s.r

  for (C = range.s.c; C <= range.e.c; ++C) {
    const cell = sheet[XLSX.utils.encode_cell({ c: C, r: R })] as XLSX.CellObject | undefined
    let hdr = 'UNKNOWN ' + C
    if (cell && cell.t) hdr = XLSX.utils.format_cell(cell)
    headers.push(hdr)
  }
  return headers
}

export { exportExcel, parseExcel, xlsxToImage }
