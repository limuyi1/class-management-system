import { PagesEnum } from '@/types/Common'
import type {
  PaperLayoutFitModeType,
  PaperLayoutModeType,
  PaperLayoutSettingsType
} from '@/types/Tools'

/** 试卷排版预设（列数、填充模式、边距与间距） */
export interface PaperLayoutPresetType {
  columns: number
  fitMode: PaperLayoutFitModeType
  margin: number
  gap: number
}

/** 各排版模式对应的预设参数 */
const paperLayoutPresetMap: Record<PaperLayoutModeType, PaperLayoutPresetType> = {
  single: {
    columns: 1,
    fitMode: 'slot',
    margin: 0,
    gap: 0
  },
  double: {
    columns: 2,
    fitMode: 'slot',
    margin: 0,
    gap: 0
  },
  free: {
    columns: 2,
    fitMode: 'width',
    margin: 0,
    gap: 0
  }
}

/** 获取指定排版模式的预设参数 */
export const getPaperLayoutPreset = (layoutMode: PaperLayoutModeType): PaperLayoutPresetType => {
  return paperLayoutPresetMap[layoutMode]
}

/** 返回默认的双栏预设 */
export const createDefaultPaperLayoutPreset = (): PaperLayoutPresetType => {
  return getPaperLayoutPreset('double')
}

/** 生成默认试卷排版设置（A4 横向、双栏） */
export const createDefaultPaperLayoutSettings = (): PaperLayoutSettingsType => {
  return {
    pageType: PagesEnum.A4,
    orientation: 'landscape',
    layoutMode: 'double',
    ...createDefaultPaperLayoutPreset()
  }
}

/**
 * 归一化试卷排版设置，缺失字段用对应模式预设兜底。
 *
 * @param settings 可能不完整的设置
 * @returns 完整的排版设置
 */
export const normalizePaperLayoutSettings = (
  settings: {
    pageType?: PagesEnum
    orientation?: PaperLayoutSettingsType['orientation']
    layoutMode?: PaperLayoutModeType
  } & Partial<PaperLayoutPresetType>
): PaperLayoutSettingsType => {
  const layoutMode = settings.layoutMode || 'double'
  const preset = getPaperLayoutPreset(layoutMode)

  return {
    pageType: settings.pageType || PagesEnum.A4,
    orientation: settings.orientation || 'landscape',
    layoutMode,
    fitMode: settings.fitMode || preset.fitMode,
    columns: settings.columns ?? preset.columns,
    margin: settings.margin ?? preset.margin,
    gap: settings.gap ?? preset.gap
  }
}
