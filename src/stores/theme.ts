import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { themes, type ThemeName, type ThemeConfig, defaultTheme } from '@/config/theme'

export const useThemeStore = defineStore(
  'theme',
  () => {
    const currentTheme = ref<ThemeName>(defaultTheme)

    const themeConfig = computed<ThemeConfig>(() => themes[currentTheme.value])

    const setTheme = (theme: ThemeName) => {
      currentTheme.value = theme
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

    const initTheme = () => {
      applyTheme()
    }

    return {
      currentTheme,
      themeConfig,
      setTheme,
      applyTheme,
      initTheme
    }
  },
  {
    persist: true
  }
)
