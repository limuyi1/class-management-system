import * as XLSX from 'xlsx'
import domtoimage from 'dom-to-image'
import { ElLoading } from 'element-plus'

/**
 * 将表格数据导出为图片
 * @param data 二维数组，第一行为表头，后续为数据行
 * @param imageName 导出图片的文件名，默认为 image.png
 * @param scale 导出缩放比例，默认为 2（提高清晰度）
 */
const xlsxToImage = (data: any[][], imageName: string = 'image.png', scale: number = 2) => {
  const loading = ElLoading.service({
    fullscreen: true,
    text: '正在导出图片，请稍后...'
  })

  const element = document.createElement('div')
  element.id = 'sheet'
  element.setAttribute('style', 'position: absolute;top: 0;z-index: -1000;')
  document.body.appendChild(element)

  const worksheet = XLSX.utils.aoa_to_sheet(data)
  element.innerHTML = XLSX.utils.sheet_to_html(worksheet)

  const selectorTable = element.querySelector('table')
  selectorTable?.setAttribute('border', '1')
  selectorTable?.setAttribute('cellspacing', '0')

  domtoimage
    .toJpeg(element, {
      quality: 1,
      width: element?.offsetWidth * scale,
      height: element?.offsetHeight * scale,
      bgcolor: '#FFFFFF',
      style: {
        transform: `scale(${scale})`,
        transformOrigin: '0 0'
      }
    })
    .then((dataUrl: string) => {
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = imageName
      link.click()
    })
    .finally(() => {
      element.remove()

      loading.close()
    })
}

/**
 * 导出 Excel 文件
 * @param headerData 表头数组，如 ['序号', '姓名', '分数']
 * @param bodyData 数据二维数组
 * @param fileName 导出文件名，默认为当前日期时间
 * @param file 预先构建好的工作簿对象，用于多 sheet 导出
 */
const exportExcel = (
  headerData?: string[],
  bodyData?: any[][],
  fileName: string = new Date().toLocaleString() + '.xlsx',
  file?: XLSX.WorkBook
) => {
  const loading = ElLoading.service({
    fullscreen: true,
    text: '正在导出Excel，请稍后...'
  })

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
    loading.close()
    return
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

  loading.close()
}

/**
 * 解析 Excel 文件，提取表头和数据集
 * @param file 文件对象，通常来自 el-upload 的 file.raw
 * @returns 包含 header（表头数组）和 data（数据数组）的对象
 */
const parseExcel = async (file: any) => {
  const dataBinary = await new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsBinaryString(file.raw)
    reader.onload = (ev: any) => {
      resolve(ev.target.result)
    }
  })

  const workBook = XLSX.read(dataBinary, { type: 'binary', cellDates: true })
  const firstWorkSheet = workBook.Sheets[workBook.SheetNames[0]]

  const header = getRow(firstWorkSheet)
  const data = XLSX.utils.sheet_to_json(firstWorkSheet)

  return { header, data }
}

/**
 * 解析获取 Excel 工作表指定行的数据
 * @param sheet 工作表对象
 * @param row 指定行索引，默认为第一行（表头行）
 * @returns 该行的数据数组
 */
const getRow = (sheet: any, row?: number) => {
  const headers = [] // 定义数组，用于存放解析好的数据
  const range = XLSX.utils.decode_range(sheet['!ref']) // 读取sheet的单元格数据
  let C
  // 表格范围的起始行索引赋值给R
  const R = row ? row : range.s.r
  for (C = range.s.c; C <= range.e.c; ++C) {
    // 使用encode_cell方法根据列索引C和行索引R获取对应单元格的数据。
    const cell = sheet[XLSX.utils.encode_cell({ c: C, r: R })]
    // 初始化hdr为默认值"UNKNOWN " + 列索引C，表示未知的表头数据。
    let hdr = 'UNKNOWN ' + C
    // 如果单元格存在且有数据类型（t表示数据类型），则使用format_cell方法格式化单元格数据，并将结果赋值给hdr。
    if (cell && cell.t) hdr = XLSX.utils.format_cell(cell)
    headers.push(hdr)
  }
  return headers // 经过上方一波操作遍历，得到最终的第一行头数据
}

export { exportExcel, parseExcel, xlsxToImage }
