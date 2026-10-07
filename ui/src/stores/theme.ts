import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { themes, type ThemeName, type ThemeConfig, defaultTheme } from '@/config/theme'

/**
 * 主题状态管理（Setup Store）
 * 管理当前主题切换，并将主题颜色写入 documentElement CSS 变量
 */
export const useThemeStore = defineStore('theme', () => {
  /** 当前主题名 */
  const preferenceKey = 'class-management-theme'
  /** 读取浏览器皮肤偏好，非法或不可用存储回退默认主题。 */
  function readPreference(): ThemeName {
    try {
      const value = localStorage.getItem(preferenceKey)
      return value && Object.prototype.hasOwnProperty.call(themes, value)
        ? (value as ThemeName)
        : defaultTheme
    } catch {
      return defaultTheme
    }
  }
  const currentTheme = ref<ThemeName>(readPreference())

  /** 当前主题对应的颜色配置 */
  const themeConfig = computed<ThemeConfig>(() => themes[currentTheme.value])

  /**
   * 切换主题
   * @param theme - 目标主题名
   */
  const setTheme = (theme: ThemeName) => {
    currentTheme.value = theme
  }

  /** 重置为默认主题并立即应用 */
  const resetTheme = () => {
    currentTheme.value = defaultTheme
    applyTheme()
  }

  /** 将当前主题的颜色配置写入 documentElement CSS 变量 */
  const applyTheme = () => {
    const config = themes[currentTheme.value]
    const root = document.documentElement

    root.style.setProperty('--theme-gradient', config.gradient)
    root.style.setProperty('--theme-primary', config.primary)
    root.style.setProperty('--theme-primary-light', config.primaryLight)
    root.style.setProperty('--theme-footer-bg', config.footerBg)
    root.style.setProperty('--theme-menu-active', config.menuActive)
    root.style.setProperty('--theme-menu-active-bg', config.menuActiveBg)
    root.style.setProperty('--theme-button-hover-bg', config.buttonHoverBg)
    root.style.setProperty('--theme-button-hover-border', config.buttonHoverBorder)
    root.style.setProperty('--theme-button-active-bg', config.buttonActiveBg)
    root.style.setProperty('--theme-button-active-border', config.buttonActiveBorder)

    config.tagColors.forEach((color, index) => {
      root.style.setProperty(`--theme-tag-${index + 1}`, color)
    })
  }

  watch(
    currentTheme,
    () => {
      applyTheme()
      try {
        localStorage.setItem(preferenceKey, currentTheme.value)
      } catch {
        // 浏览器禁用存储时，本次会话仍可切换皮肤。
      }
    },
    { immediate: true }
  )

  /** 初始化主题（主题颜色已由 watcher 自动应用，无需手动处理） */
  const initTheme = () => {
    // 主题已通过 watcher 自动应用
  }

  return {
    currentTheme,
    themeConfig,
    setTheme,
    resetTheme,
    applyTheme,
    initTheme
  }
})
