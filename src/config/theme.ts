/** 主题色彩配置 */
export type ThemeName = 'green' | 'orange' | 'purple' | 'bluepink'

/** 主题配置项 */
export interface ThemeConfig {
  name: ThemeName
  label: string
  gradient: string
  primary: string
  primaryLight: string
  footerBg: string
  menuActive: string
  menuActiveBg: string
  emptyBg: string
  emptyIcon: string
  buttonHoverBg: string
  buttonHoverBorder: string
  buttonActiveBg: string
  buttonActiveBorder: string
  tagColors: string[]
}

export const themes: Record<ThemeName, ThemeConfig> = {
  green: {
    name: 'green',
    label: '清新绿',
    gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
    primary: '#10B981',
    primaryLight: '#6EE7B7',
    footerBg: '#059669',
    menuActive: '#10B981',
    menuActiveBg: '#ECFDF5',
    emptyBg: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
    emptyIcon: '#10B981',
    buttonHoverBg: '#ECFDF5',
    buttonHoverBorder: '#6EE7B7',
    buttonActiveBg: '#D1FAE5',
    buttonActiveBorder: '#10B981',
    tagColors: [
      '#67c23a',
      '#409eff',
      '#e6a23c',
      '#f56c6c',
      '#909399',
      '#c71585',
      '#37a168',
      '#2b7cde'
    ]
  },
  orange: {
    name: 'orange',
    label: '阳光橙',
    gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    footerBg: '#D97706',
    menuActive: '#F59E0B',
    menuActiveBg: '#FFFBEB',
    emptyBg: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
    emptyIcon: '#F59E0B',
    buttonHoverBg: '#FFFBEB',
    buttonHoverBorder: '#FCD34D',
    buttonActiveBg: '#FEF3C7',
    buttonActiveBorder: '#F59E0B',
    tagColors: [
      '#67c23a',
      '#409eff',
      '#e6a23c',
      '#f56c6c',
      '#909399',
      '#c71585',
      '#37a168',
      '#2b7cde'
    ]
  },
  purple: {
    name: 'purple',
    label: '优雅紫',
    gradient: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
    primary: '#6366F1',
    primaryLight: '#A5B4FC',
    footerBg: '#4F46E5',
    menuActive: '#6366F1',
    menuActiveBg: '#EEF2FF',
    emptyBg: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
    emptyIcon: '#6366F1',
    buttonHoverBg: '#EEF2FF',
    buttonHoverBorder: '#A5B4FC',
    buttonActiveBg: '#E0E7FF',
    buttonActiveBorder: '#6366F1',
    tagColors: [
      '#67c23a',
      '#409eff',
      '#e6a23c',
      '#f56c6c',
      '#909399',
      '#c71585',
      '#37a168',
      '#2b7cde'
    ]
  },
  bluepink: {
    name: 'bluepink',
    label: '柔和蓝粉',
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
    primary: '#8B5CF6',
    primaryLight: '#C4B5FD',
    footerBg: '#6D28D9',
    menuActive: '#8B5CF6',
    menuActiveBg: '#F5F3FF',
    emptyBg: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
    emptyIcon: '#8B5CF6',
    buttonHoverBg: '#F5F3FF',
    buttonHoverBorder: '#C4B5FD',
    buttonActiveBg: '#EDE9FE',
    buttonActiveBorder: '#8B5CF6',
    tagColors: [
      '#67c23a',
      '#409eff',
      '#e6a23c',
      '#f56c6c',
      '#909399',
      '#c71585',
      '#37a168',
      '#2b7cde'
    ]
  }
}

export const defaultTheme: ThemeName = 'bluepink'

export const themeOptions: Array<{ name: ThemeName; label: string; color: string }> = [
  { name: 'green', label: '清新绿', color: '#10B981' },
  { name: 'orange', label: '阳光橙', color: '#F59E0B' },
  { name: 'purple', label: '优雅紫', color: '#6366F1' },
  { name: 'bluepink', label: '柔和蓝粉', color: '#8B5CF6' }
]
