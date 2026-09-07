import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { useThemeStore } from '../../src/stores/theme'
import { themes } from '../../src/config/theme'

/**
 * useThemeStore store 测试
 * 测试目标：主题 setup store
 * 覆盖功能：默认主题初始化（watcher 立即应用）、themeConfig 查表、
 * setTheme 后 CSS 变量写入、resetTheme 恢复默认
 */
describe('useThemeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('applies the default theme colors on store creation', () => {
    useThemeStore()

    const root = document.documentElement
    expect(root.style.getPropertyValue('--theme-primary')).toBe(themes.bluepink.primary)
    expect(root.style.getPropertyValue('--theme-gradient')).toBe(themes.bluepink.gradient)
    expect(root.style.getPropertyValue('--theme-tag-1')).toBe(themes.bluepink.tagColors[0])
  })

  it('exposes the current theme config via computed', () => {
    const store = useThemeStore()

    expect(store.currentTheme).toBe('bluepink')
    expect(store.themeConfig.name).toBe('bluepink')
    expect(store.themeConfig.primary).toBe(themes.bluepink.primary)
  })

  it('switches theme and applies its colors to CSS variables', async () => {
    const store = useThemeStore()

    store.setTheme('orange')
    await nextTick()

    expect(store.currentTheme).toBe('orange')
    expect(store.themeConfig.primary).toBe(themes.orange.primary)
    const root = document.documentElement
    expect(root.style.getPropertyValue('--theme-primary')).toBe(themes.orange.primary)
    expect(root.style.getPropertyValue('--theme-footer-bg')).toBe(themes.orange.footerBg)
    expect(root.style.getPropertyValue('--theme-button-active-bg')).toBe(
      themes.orange.buttonActiveBg
    )
    expect(root.style.getPropertyValue('--theme-tag-2')).toBe(themes.orange.tagColors[1])
  })

  it('resets to the default theme and applies it immediately', async () => {
    const store = useThemeStore()
    store.setTheme('purple')
    await nextTick()

    store.resetTheme()

    expect(store.currentTheme).toBe('bluepink')
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe(
      themes.bluepink.primary
    )
  })
})
