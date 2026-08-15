import { PagesEnum } from '@/types/Common'

/** 版纸方向：纵向 / 横向 */
export type PaperLayoutOrientationType = 'portrait' | 'landscape'
/** 排版模式：单栏 / 双栏 / 自由 */
export type PaperLayoutModeType = 'single' | 'double' | 'free'
/** 素材缩放模式：按宽度适配 / 按槽位适配 */
export type PaperLayoutFitModeType = 'width' | 'slot'

/** 版纸布局设置 */
export interface PaperLayoutSettingsType {
  /** 纸张类型 */
  pageType: PagesEnum
  /** 纸张方向：纵向 / 横向 */
  orientation: PaperLayoutOrientationType
  /** 排版模式 */
  layoutMode: PaperLayoutModeType
  /** 素材缩放模式 */
  fitMode: PaperLayoutFitModeType
  /** 栏数 */
  columns: number
  /** 页边距 */
  margin: number
  /** 素材间距 */
  gap: number
}

/** 工具模块 Store 状态 */
export interface ToolsStateType {
  /** 版纸布局设置 */
  paperLayout: PaperLayoutSettingsType
}

/** 附件库记录 */
export interface AttachmentRecordType {
  /** 附件唯一标识 */
  id: string
  /** 附件名称 */
  name: string
  /** MIME 类型 */
  mimeType: string
  /** 附件二进制内容 */
  blob: Blob
  /** 排序权重（数值越小越靠前） */
  sortOrder: number
  /** 附件宽度（像素） */
  width: number
  /** 附件高度（像素） */
  height: number
  /** 附件大小（字节） */
  size: number
  /** 创建时间（ISO 格式） */
  createdAt: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 版纸素材项 */
export interface PaperLayoutCanvasItemType {
  /** 素材实例唯一标识 */
  id: string
  /** 关联的附件 ID */
  attachmentId: string
  /** 素材名称 */
  name: string
  /** 素材二进制内容 */
  blob: Blob
  /** 素材数据 URL（用于直接渲染） */
  dataUrl: string
  /** MIME 类型 */
  mimeType: string
  /** 原始宽度（像素） */
  naturalWidth: number
  /** 原始高度（像素） */
  naturalHeight: number
  /** 所在页码（0 起始） */
  pageIndex: number
  /** 在文档中的 X 坐标 */
  x: number
  /** 在文档中的 Y 坐标 */
  y: number
  /** 在文档整体中的 Y 坐标（跨页时用于定位） */
  documentY: number
  /** 显示宽度 */
  width: number
  /** 显示高度 */
  height: number
  /** 层级（z-index） */
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
  /** 页码（0 起始） */
  index: number
  /** 该页的渲染项列表 */
  items: PaperLayoutRenderItemType[]
}

/** 版纸拖拽状态 */
export interface PaperLayoutDragStateType {
  /** 被拖拽的素材实例 ID */
  itemId: string
  /** 拖拽模式：移动 / 缩放 */
  mode: 'move' | 'resize'
  /** 拖拽起始客户端 X 坐标 */
  startClientX: number
  /** 拖拽起始客户端 Y 坐标 */
  startClientY: number
  /** 拖拽起始的素材 X 坐标 */
  startX: number
  /** 拖拽起始的素材 Y 坐标 */
  startY: number
  /** 拖拽起始的文档整体 Y 坐标 */
  startDocumentY: number
  /** 拖拽起始的素材宽度 */
  startWidth: number
  /** 拖拽起始的素材高度 */
  startHeight: number
}

/** 版纸草稿项（可序列化的素材快照） */
export interface PaperLayoutDraftItemType {
  /** 关联的附件 ID */
  attachmentId: string
  /** 素材名称 */
  name: string
  /** MIME 类型 */
  mimeType: string
  /** 素材二进制内容 */
  blob: Blob
  /** 原始宽度（像素） */
  naturalWidth: number
  /** 原始高度（像素） */
  naturalHeight: number
  /** 排序权重（可选） */
  order?: number
  /** 素材实例 ID（可选） */
  id?: string
  /** 所在页码（可选） */
  pageIndex?: number
  /** 在文档中的 X 坐标（可选） */
  x?: number
  /** 在文档中的 Y 坐标（可选） */
  y?: number
  /** 在文档整体中的 Y 坐标（可选） */
  documentY?: number
  /** 显示宽度（可选） */
  width?: number
  /** 显示高度（可选） */
  height?: number
  /** 层级 z-index（可选） */
  zIndex?: number
}

/** 版纸草稿持久化记录 */
export interface PaperLayoutDraftRecordType {
  /** 草稿唯一标识 */
  id: string
  /** 草稿名称 */
  name: string
  /** 版纸布局设置 */
  settings: PaperLayoutSettingsType
  /** 草稿素材项列表 */
  items: PaperLayoutDraftItemType[]
  /** 创建时间（ISO 格式） */
  createdAt: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}
