import { Worker } from 'node:worker_threads'
import { BusinessError } from './errors.js'
/** 限制并行转换，Worker 可超时终止，不阻塞同步 SQLite 线程。 */
let active = 0
export async function convertExcel(
  mode: 'read' | 'write',
  data: Uint8Array | unknown[][]
): Promise<{ rows?: unknown[][]; bytes?: Uint8Array }> {
  if (active >= 2) throw new BusinessError(429, 'EXPORT_BUSY', '请稍后重试导入或导出')
  active++
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/excel.js', import.meta.url), {
        workerData: { mode, data },
        resourceLimits: { maxOldGenerationSizeMb: 128 }
      })
      const timer = setTimeout(() => {
        void worker.terminate()
        reject(new BusinessError(400, 'EXCEL_TIMEOUT', 'Excel 处理超时，请缩小文件'))
      }, 15000)
      worker.once(
        'message',
        (result: { rows?: unknown[][]; bytes?: Uint8Array; error?: string }) => {
          clearTimeout(timer)
          void worker.terminate()
          result.error
            ? reject(new BusinessError(400, 'INVALID_EXCEL', result.error))
            : resolve(result)
        }
      )
      worker.once('error', () => {
        clearTimeout(timer)
        reject(new BusinessError(400, 'INVALID_EXCEL', 'Excel 处理失败'))
      })
      worker.once('exit', (code) => {
        clearTimeout(timer)
        if (code !== 0) reject(new BusinessError(400, 'INVALID_EXCEL', 'Excel 处理被终止'))
      })
    })
  } finally {
    active--
  }
}
