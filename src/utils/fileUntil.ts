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

const dataUrlToBase64 = (dataUrl: string): string => {
  return dataUrl.replace(/^data:image\/\w+;base64,/, '')
}

const getBase64ByteSize = (base64: string): number => {
  const normalized = base64.replace(/\s/g, '')
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.max(Math.floor((normalized.length * 3) / 4) - padding, 0)
}

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0kb'
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)}kb`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

const estimateCompressedImageSize = (base64: string, ratio: number | null): number => {
  const sourceSize = getBase64ByteSize(base64)
  if (!ratio) return sourceSize
  return Math.max(Math.round(sourceSize * ratio * ratio), 1)
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('图片压缩失败'))
      },
      mimeType,
      quality
    )
  })
}

const compressDataUrlByRatio = async (
  dataUrl: string,
  ratio: number | null,
  quality = 0.85
): Promise<{ base64: string; size: number; width: number; height: number }> => {
  if (!ratio) {
    const base64 = dataUrlToBase64(dataUrl)
    return {
      base64,
      size: getBase64ByteSize(base64),
      width: 0,
      height: 0
    }
  }

  const image = await loadImage(dataUrl)
  const width = Math.max(Math.round(image.naturalWidth * ratio), 1)
  const height = Math.max(Math.round(image.naturalHeight * ratio), 1)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('当前浏览器不支持图片压缩')
  }

  canvas.width = width
  canvas.height = height
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  const base64 = await blobToBase64(blob)

  return {
    base64,
    size: blob.size,
    width,
    height
  }
}

export {
  fileToBase64,
  fileToBlob,
  blobToBase64,
  blobToDataUrl,
  base64ToBlob,
  dataUrlToBase64,
  getBase64ByteSize,
  formatFileSize,
  estimateCompressedImageSize,
  compressDataUrlByRatio
}
