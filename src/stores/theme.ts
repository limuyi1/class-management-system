import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { themes, type ThemeName, type ThemeConfig, defaultTheme } from '@/config/theme'

const STORAGE_KEY = 'class-management-theme'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<ThemeName>(defaultTheme)

  const themeConfig = computed<ThemeConfig>(() => themes[currentTheme.value])

  const initTheme = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && themes[saved as ThemeName]) {
      currentTheme.value = saved as ThemeName
    }
    applyTheme()
  }

  const setTheme = (theme: ThemeName) => {
    currentTheme.value = theme
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme()
  }

  const applyTheme = () => {
    const config = themes[currentTheme.value]
    const root = document.documentElement

    root.style.setProperty('--theme-gradient', config.gradient)
    root.style.setProperty('--theme-primary', config.primary)
    root.style.setProperty('--theme-primary-light', config.primaryLight)
    root.style.setProperty('--theme-footer-bg', config.footerBg)
    root.style.setProperty('--theme-menu-active', config.menuActive)
    root.style.setProperty('--theme-menu-active-bg', config.menuActiveBg)
  }

  return {
    currentTheme,
    themeConfig,
    initTheme,
    setTheme,
    applyTheme
  }
})
