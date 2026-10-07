import { validateExcelArchive } from '../services/excelArchive.js'
import { parentPort, workerData } from 'node:worker_threads'
import * as XLSX from 'xlsx'

/** 隔离 Excel 转换内存与 CPU；单次只处理有界名单，不执行单元格公式。 */
try {
  const job = workerData as { mode: 'read' | 'write'; data: Uint8Array | unknown[][] }
  if (job.mode === 'read') {
    validateExcelArchive(job.data as Uint8Array)
    const book = XLSX.read(job.data as Uint8Array, {
      type: 'array',
      sheetRows: 2002,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      bookVBA: false
    })
    if (book.SheetNames.length > 10) throw new Error('工作表过多')
    const sheet = book.Sheets[book.SheetNames[0]!]!
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    if (range.e.c >= 200 || range.e.r > 2000) throw new Error('最多 2000 行、200 列')
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true })
      .map((row) =>
        row.map((value) =>
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? value
            : null
        )
      )
    parentPort?.postMessage({ rows })
  } else {
    const sheet = XLSX.utils.aoa_to_sheet(job.data as unknown[][])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, '教学数据')
    parentPort?.postMessage({ bytes: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) })
  }
} catch {
  parentPort?.postMessage({ error: 'Excel 格式无效或超出大小限制' })
}
