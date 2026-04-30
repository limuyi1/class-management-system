/**
 * 文件处理工具函数
 * 提供文件与 Base64/Blob 互转等功能
 */

/**
 * 将 File 对象转换为 Base64 字符串（不含前缀）
 * @param file - File 对象
 * @returns Base64 字符串（不含 data:image/xxx;base64, 前缀）
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.replace(/^data:image\/\w+;base64,/, '')
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 将 File 对象转换为 Blob
 * @param file - File 对象
 * @returns Blob 对象
 */
const fileToBlob = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as ArrayBuffer
      const blob = new Blob([result], { type: file.type })
      resolve(blob)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 将 Blob 转换为 Base64 字符串（不含前缀）
 * @param blob - Blob 对象
 * @returns Base64 字符串
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.replace(/^data:image\/\w+;base64,/, '')
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(String(reader.result || ''))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const base64ToBlob = (base64: string, mimeType = 'image/jpeg'): Blob => {
  const binaryString = window.atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

export { fileToBase64, fileToBlob, blobToBase64, blobToDataUrl, base64ToBlob }
