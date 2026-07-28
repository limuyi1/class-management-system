import { PagesEnum } from '@/types/Common'

/** 版纸方向：纵向 / 横向 */
export type PaperLayoutOrientationType = 'portrait' | 'landscape'
/** 排版模式：单栏 / 双栏 / 自由 */
export type PaperLayoutModeType = 'single' | 'double' | 'free'
/** 素材缩放模式：按宽度适配 / 按槽位适配 */
export type PaperLayoutFitModeType = 'width' | 'slot'

/** 版纸布局设置 */
export interface PaperLayoutSettingsType {
  pageType: PagesEnum
  orientation: PaperLayoutOrientationType
  layoutMode: PaperLayoutModeType
  fitMode: PaperLayoutFitModeType
  columns: number
  margin: number
  gap: number
}

/** 工具模块 Store 状态 */
export interface ToolsStateType {
  paperLayout: PaperLayoutSettingsType
}

/** 附件库记录 */
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

/** 版纸素材项 */
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
  documentY: number
  width: number
  height: number
  zIndex: number
}

/** 版纸渲染项（扩展了页面内局部 Y 坐标） */
export interface PaperLayoutRenderItemType extends PaperLayoutCanvasItemType {
  /**
   * 当前页面内的渲染 Y 坐标。同一张图片跨页时会在多页生成渲染片段，
   * 因此该值可能为负数，由页面自身 overflow 裁切出可见区域。
   */
  localY: number
}

/** 版纸分页信息 */
export interface PaperLayoutPageType {
  index: number
  items: PaperLayoutRenderItemType[]
}

/** 版纸拖拽状态 */
export interface PaperLayoutDragStateType {
  itemId: string
  mode: 'move' | 'resize'
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startDocumentY: number
  startWidth: number
  startHeight: number
}

/** 版纸草稿项（可序列化的素材快照） */
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
  documentY?: number
  width?: number
  height?: number
  zIndex?: number
}

/** 版纸草稿持久化记录 */
export interface PaperLayoutDraftRecordType {
  id: string
  name: string
  settings: PaperLayoutSettingsType
  items: PaperLayoutDraftItemType[]
  createdAt: string
  updatedAt: string
}
