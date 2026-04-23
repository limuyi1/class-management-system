import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { themes, type ThemeName, type ThemeConfig, defaultTheme } from '@/config/theme'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<ThemeName>(defaultTheme)

  const themeConfig = computed<ThemeConfig>(() => themes[currentTheme.value])

  const setTheme = (theme: ThemeName) => {
    currentTheme.value = theme
  }

  const resetTheme = () => {
    currentTheme.value = defaultTheme
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
    },
    { immediate: true }
  )

  const initTheme = () => {
    // Theme is now applied automatically via watcher
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
