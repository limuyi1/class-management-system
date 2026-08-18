/**
 * 手写字体管理工具
 * 负责默认/用户字体的加载、注册、保存与缺字检测
 */
import fontkit from '@pdf-lib/fontkit'

import { useConfigurationStore } from '@/stores/configuration'
import { NAME_PROP } from '@/constants'
import type { ConfigurationType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

/** 默认手写字体资源地址 */
const DEFAULT_HANDWRITE_FONT_URL = new URL('../assets/font/fuyao-shoushu.ttf', import.meta.url).href
/** 动态注册的用户手写字体 family 名称 */
const CUSTOM_HANDWRITE_FONT_FAMILY = 'EvaluationHandwriteFont'
/** 默认手写字体 family 名称 */
const DEFAULT_HANDWRITE_FONT_FAMILY = 'FYFont'
/** 字体加载超时时间（毫秒） */
const FONT_LOAD_TIMEOUT_MS = 10000
/** 字体加载偏慢时的提示阈值（毫秒） */
const DEFAULT_FONT_SLOW_NOTICE_MS = 8000
/** 允许上传的字体文件最大字节数（30MB） */
const MAX_FONT_FILE_SIZE_BYTES = 30 * 1024 * 1024

let cachedDefaultFontPromise: Promise<Uint8Array> | null = null
let activeCustomFontFace: FontFace | null = null

// configuration store 目前通过 JSON 持久化，字体二进制需要转成 base64 才能稳定保存。
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  // 分块拼接，避免一次性展开超大数组导致调用栈溢出。
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

/** ArrayBuffer 转 Base64 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => uint8ArrayToBase64(new Uint8Array(buffer))

/** Base64 转 Uint8Array */
const base64ToUint8Array = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

/** 加载默认手写字体字节（带超时与失败重试清理） */
const fetchDefaultHandwriteFontBytes = async (): Promise<Uint8Array> => {
  if (!cachedDefaultFontPromise) {
    cachedDefaultFontPromise = (async () => {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), FONT_LOAD_TIMEOUT_MS)

      try {
        const response = await fetch(DEFAULT_HANDWRITE_FONT_URL, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`默认手写字体加载失败，HTTP状态: ${response.status}`)
        }
        return new Uint8Array(await response.arrayBuffer())
      } finally {
        window.clearTimeout(timeoutId)
      }
    })().catch((error) => {
      cachedDefaultFontPromise = null
      throw error
    })
  }

  return cachedDefaultFontPromise
}

/** 返回动态注册的用户手写字体 family 名称 */
export const getEvaluationHandwriteFontFamily = () => CUSTOM_HANDWRITE_FONT_FAMILY

/** 返回测量用的字体栈：优先用户字体，回退默认字体 */
export const getEvaluationHandwriteMeasureFontFamily = () => {
  return `${CUSTOM_HANDWRITE_FONT_FAMILY}, ${DEFAULT_HANDWRITE_FONT_FAMILY}`
}

/** 返回默认字体加载慢提示阈值（毫秒） */
export const getDefaultFontSlowNoticeMs = () => DEFAULT_FONT_SLOW_NOTICE_MS

/** 返回允许上传的字体文件最大字节数 */
export const getMaxHandwriteFontFileSizeBytes = () => MAX_FONT_FILE_SIZE_BYTES

/** 返回已保存用户字体的文件名，未保存时返回空字符串 */
export const getSavedHandwriteFontName = () => {
  return useConfigurationStore().evaluationHandwriteFont?.name || ''
}

/** 是否已保存用户手写字体 */
export const hasSavedHandwriteFont = () => {
  return Boolean(useConfigurationStore().evaluationHandwriteFont?.data)
}

/**
 * 获取手写字体字节：优先用户上传字体，否则加载默认字体。
 * @returns 字体文件字节
 */
export const getEvaluationHandwriteFontBytes = async (): Promise<Uint8Array> => {
  const savedFont = useConfigurationStore().evaluationHandwriteFont

  // 用户字体和默认字体都从这里返回，PDF 导出与预览注册使用同一份来源。
  if (savedFont?.data) {
    return base64ToUint8Array(savedFont.data)
  }

  return fetchDefaultHandwriteFontBytes()
}

/**
 * 为 DOM 图片导出生成可嵌入 CSS 的字体数据地址。
 * @returns 字体 data URL
 */
export const getEvaluationHandwriteFontDataUrl = async (): Promise<string> => {
  const configuration = useConfigurationStore()
  const bytes = await getEvaluationHandwriteFontBytes()
  const mimeType = configuration.evaluationHandwriteFont?.name.toLowerCase().endsWith('.otf')
    ? 'font/otf'
    : 'font/ttf'
  return `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`
}

/**
 * 保存用户上传的手写字体：校验格式与大小、解析合法性后写入配置并注册。
 * @param file - 字体文件（.ttf 或 .otf）
 */
export const saveEvaluationHandwriteFont = async (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension !== 'ttf' && extension !== 'otf') {
    throw new Error('请选择 .ttf 或 .otf 格式的字体文件')
  }

  if (file.size > MAX_FONT_FILE_SIZE_BYTES) {
    throw new Error('字体文件不能超过 30MB')
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // 提前用 fontkit 解析一次，避免把无效字体写入 IndexedDB。
  fontkit.create(bytes)

  const configuration = useConfigurationStore()
  configuration.evaluationHandwriteFont = {
    name: file.name,
    data: arrayBufferToBase64(buffer),
    updatedAt: new Date().toISOString()
  }

  await registerEvaluationHandwriteFont(bytes)
  // 字体真正注册完成后替换对象引用，让预览按新字体重新测量断行。
  configuration.evaluationHandwriteFont = { ...configuration.evaluationHandwriteFont }
}

/** 清除用户上传的手写字体，恢复为默认字体 */
export const clearEvaluationHandwriteFont = () => {
  const configuration = useConfigurationStore()
  configuration.evaluationHandwriteFont = null

  if (activeCustomFontFace && document.fonts) {
    document.fonts.delete(activeCustomFontFace)
    activeCustomFontFace = null
  }
}

/**
 * 以固定 family 名称动态注册手写字体，供 CSS 与 canvas 测量共同使用。
 * @param bytes - 字体字节，缺省时自动获取（用户字体优先）
 */
export const registerEvaluationHandwriteFont = async (bytes?: Uint8Array) => {
  const fontBytes = bytes || (await getEvaluationHandwriteFontBytes())

  if (!('FontFace' in window) || !document.fonts) {
    return
  }

  if (activeCustomFontFace) {
    document.fonts.delete(activeCustomFontFace)
  }

  // 动态注册固定 family 名称，CSS 和 canvas 测量都通过这个名称命中用户字体。
  const buffer = new Uint8Array(fontBytes).buffer
  const fontFace = new FontFace(CUSTOM_HANDWRITE_FONT_FAMILY, buffer)
  activeCustomFontFace = await fontFace.load()
  document.fonts.add(activeCustomFontFace)
}

/**
 * 等待默认手写字体加载完成。
 * @returns 字体加载结果 Promise
 */
export const waitForDefaultHandwriteFont = () => {
  if (!document.fonts) {
    return Promise.resolve([])
  }

  return document.fonts.load(`18px ${DEFAULT_HANDWRITE_FONT_FAMILY}`)
}

/**
 * 将学生评语拼装为导出文本（"姓名同学：评语+落款"），用于缺字检测等场景。
 * @param students - 学生列表
 * @param configuration - 应用配置（含落款文本）
 * @returns 拼接后的完整文本
 */
export const buildEvaluationExportText = (
  students: StudentDataType[],
  configuration: ConfigurationType
) => {
  return students
    .map((student) => {
      const name =
        student[NAME_PROP] === undefined || student[NAME_PROP] === null
          ? ''
          : String(student[NAME_PROP])

      return `${name}同学：${student.comment || ''}${configuration.inscribe || ''}`
    })
    .join('\n')
}

/**
 * 判断字符是否为需要字体提供字形的可见字符（排除空白与零宽/变体选择符）。
 * @param char - 待判断字符
 * @returns 是否需要字形
 */
export const isEvaluationRenderableTextChar = (char: string) => {
  if (char.trim() === '') return false

  const codePoint = char.codePointAt(0)
  if (codePoint === undefined) return false

  return !(
    (codePoint >= 0x200b && codePoint <= 0x200d) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    codePoint === 0xfeff
  )
}

/**
 * 检测导出文本中是否存在当前手写字体缺失的字形。
 * @param students - 学生列表
 * @param configuration - 应用配置
 * @returns 是否存在缺字
 */
export const hasUnsupportedEvaluationHandwriteGlyphs = async (
  students: StudentDataType[],
  configuration: ConfigurationType
) => {
  const bytes = await getEvaluationHandwriteFontBytes()
  const font = fontkit.create(bytes)
  const text = buildEvaluationExportText(students, configuration)

  // 导出前只判断可见字符是否缺字；换行、空格、零宽字符不需要字体提供可绘制字形。
  return Array.from(new Set(Array.from(text).filter(isEvaluationRenderableTextChar))).some(
    (char) => {
      const codePoint = char.codePointAt(0)
      return codePoint !== undefined && !font.hasGlyphForCodePoint(codePoint)
    }
  )
}
