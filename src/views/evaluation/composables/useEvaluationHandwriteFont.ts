import { computed, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  clearEvaluationHandwriteFont,
  getDefaultFontSlowNoticeMs,
  hasSavedHandwriteFont,
  registerEvaluationHandwriteFont,
  saveEvaluationHandwriteFont,
  waitForDefaultHandwriteFont
} from '@/utils/evaluationHandwriteFontUntil'
import type { ConfigurationType } from '@/types/Configuration'

interface UseEvaluationHandwriteFontOptions {
  configuration: ConfigurationType
  fontFileInputRef: Ref<HTMLInputElement | null>
}

export function formatHandwriteFontName(name: string): string {
  if (!name || name.length <= 18) return name

  const dotIndex = name.lastIndexOf('.')
  const extension = dotIndex > -1 ? name.slice(dotIndex) : ''
  const baseName = dotIndex > -1 ? name.slice(0, dotIndex) : name
  const head = baseName.slice(0, 5)
  const tail = baseName.slice(Math.max(baseName.length - 3, 5))

  return `${head}...${tail}${extension}`
}

export function useEvaluationHandwriteFont(options: UseEvaluationHandwriteFontOptions) {
  const handwriteFontApplying = ref(false)
  const showDefaultFontSlowNotice = ref(false)
  const savedHandwriteFontName = computed(
    () => options.configuration.evaluationHandwriteFont?.name || ''
  )
  const displayHandwriteFontName = computed(() =>
    formatHandwriteFontName(savedHandwriteFontName.value)
  )

  async function startDefaultFontMonitor(): Promise<void> {
    if (hasSavedHandwriteFont()) return

    let loaded = false
    const timer = window.setTimeout(() => {
      if (!loaded && !hasSavedHandwriteFont()) {
        showDefaultFontSlowNotice.value = true
      }
    }, getDefaultFontSlowNoticeMs())

    try {
      await waitForDefaultHandwriteFont()
    } finally {
      loaded = true
      window.clearTimeout(timer)
      showDefaultFontSlowNotice.value = false
    }
  }

  async function initializeHandwriteFont(): Promise<void> {
    if (hasSavedHandwriteFont()) {
      try {
        await registerEvaluationHandwriteFont()
        options.configuration.evaluationHandwriteFont = options.configuration.evaluationHandwriteFont
          ? { ...options.configuration.evaluationHandwriteFont }
          : null
      } catch (error) {
        console.error('恢复本地手写字体失败:', error)
        ElMessage.warning('本地手写字体恢复失败，已切换为默认字体')
        clearEvaluationHandwriteFont()
        await startDefaultFontMonitor()
      }
      return
    }

    await startDefaultFontMonitor()
  }

  function handleChooseHandwriteFont(): void {
    options.fontFileInputRef.value?.click()
  }

  async function handleHandwriteFontChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''

    if (!file) return

    handwriteFontApplying.value = true
    try {
      await saveEvaluationHandwriteFont(file)
      showDefaultFontSlowNotice.value = false
      ElMessage.success('手写字体已应用')
    } catch (error) {
      console.error('应用手写字体失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '手写字体应用失败')
    } finally {
      handwriteFontApplying.value = false
    }
  }

  async function handleClearHandwriteFont(): Promise<void> {
    clearEvaluationHandwriteFont()
    ElMessage.success('已恢复默认手写字体')
    await startDefaultFontMonitor()
  }

  return {
    displayHandwriteFontName,
    handwriteFontApplying,
    handleChooseHandwriteFont,
    handleClearHandwriteFont,
    handleHandwriteFontChange,
    initializeHandwriteFont,
    savedHandwriteFontName,
    showDefaultFontSlowNotice,
    startDefaultFontMonitor
  }
}
