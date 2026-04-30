import { PagesEnum } from '@/types/Common'
import type { PaperLayoutOrientationType, PaperLayoutSettingsType } from '@/types/Tools'

export interface PaperLayoutPresetType {
  columns: number
  margin: number
  gap: number
}

const paperLayoutPresetMap: Record<PaperLayoutOrientationType, PaperLayoutPresetType> = {
  portrait: {
    columns: 1,
    margin: 10,
    gap: 6
  },
  landscape: {
    columns: 2,
    margin: 10,
    gap: 6
  }
}

export const getPaperLayoutPreset = (
  orientation: PaperLayoutOrientationType
): PaperLayoutPresetType => {
  return paperLayoutPresetMap[orientation]
}

export const createDefaultPaperLayoutPreset = (): PaperLayoutPresetType => {
  return getPaperLayoutPreset('landscape')
}

export const createDefaultPaperLayoutSettings = (): PaperLayoutSettingsType => {
  return {
    pageType: PagesEnum.A4,
    orientation: 'landscape' as PaperLayoutOrientationType,
    ...createDefaultPaperLayoutPreset()
  }
}

export const normalizePaperLayoutSettings = (
  settings: {
    pageType?: PagesEnum
    orientation?: PaperLayoutOrientationType
  } & Partial<PaperLayoutPresetType>
): PaperLayoutSettingsType => {
  const orientation = settings.orientation || 'landscape'

  return {
    pageType: settings.pageType || PagesEnum.A4,
    orientation,
    ...getPaperLayoutPreset(orientation)
  }
}
