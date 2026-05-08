import { PagesEnum } from '@/types/Common'

export type PaperLayoutOrientationType = 'portrait' | 'landscape'

export interface PaperLayoutSettingsType {
  pageType: PagesEnum
  orientation: PaperLayoutOrientationType
  columns: number
  margin: number
  gap: number
}

export interface ToolsStateType {
  paperLayout: PaperLayoutSettingsType
}

export interface AttachmentRecordType {
  id: string
  name: string
  mimeType: string
  blob: Blob
  sortOrder: number
  width: number
  height: number
  size: number
  createdAt: string
  updatedAt: string
}

export interface PaperLayoutCanvasItemType {
  id: string
  attachmentId: string
  name: string
  blob: Blob
  dataUrl: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

export interface PaperLayoutPageType {
  index: number
  items: PaperLayoutCanvasItemType[]
}

export interface PaperLayoutDragStateType {
  itemId: string
  mode: 'move' | 'resize'
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

export interface PaperLayoutDraftItemType {
  attachmentId: string
  name: string
  mimeType: string
  blob: Blob
  naturalWidth: number
  naturalHeight: number
  order?: number
  id?: string
  pageIndex?: number
  x?: number
  y?: number
  width?: number
  height?: number
  zIndex?: number
}

export interface PaperLayoutDraftRecordType {
  id: string
  name: string
  settings: PaperLayoutSettingsType
  items: PaperLayoutDraftItemType[]
  createdAt: string
  updatedAt: string
}
