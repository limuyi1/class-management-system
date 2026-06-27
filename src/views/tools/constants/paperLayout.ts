import { PagesEnum } from '@/types/Common'
import type {
  PaperLayoutFitModeType,
  PaperLayoutModeType,
  PaperLayoutSettingsType
} from '@/types/Tools'

export interface PaperLayoutPresetType {
  columns: number
  fitMode: PaperLayoutFitModeType
  margin: number
  gap: number
}

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

export const getPaperLayoutPreset = (layoutMode: PaperLayoutModeType): PaperLayoutPresetType => {
  return paperLayoutPresetMap[layoutMode]
}

export const createDefaultPaperLayoutPreset = (): PaperLayoutPresetType => {
  return getPaperLayoutPreset('double')
}

export const createDefaultPaperLayoutSettings = (): PaperLayoutSettingsType => {
  return {
    pageType: PagesEnum.A4,
    orientation: 'landscape',
    layoutMode: 'double',
    ...createDefaultPaperLayoutPreset()
  }
}

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
