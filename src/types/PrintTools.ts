import type { PrintTemplateSceneType } from './PrintTemplateScene'
import type { StudentSourceStudentType } from './StudentSource'

/** 打印名单行，fields 保留 Excel 的自定义列用于卡片变量。 */
export interface PrintStudentType extends StudentSourceStudentType {
  /** 列名到文本值的映射；同名列覆盖卡片公共字段 */
  fields: Record<string, string>
}

/** 名单打印预设类型。 */
export enum RosterTemplateEnum {
  Compact = 'compact',
  Collection = 'collection',
  Attendance = 'attendance',
  Scores = 'scores',
  Signature = 'signature'
}

/** 名单排版设置，行高以毫米表示。 */
export interface RosterPrintSettingsType {
  template: RosterTemplateEnum
  title: string
  subtitle: string
  landscape: boolean
  /** 事项列标题，空字符串表示供老师手写的空白表头 */
  columns: string[]
  rowHeight: number
  remarks: boolean
  doubleColumn: boolean
}

/** 分页后的纸张与名单分栏，保留全局连续序号。 */
export interface RosterPrintPageType {
  width: number
  height: number
  groups: Array<Array<PrintStudentType & { number: number }>>
  page: number
  pageCount: number
}

/** 卡片编辑器支持的图层类型。 */
export enum CardLayerKindEnum {
  Text = 'text',
  Image = 'image'
}

/** 图层位置和尺寸使用毫米，字号使用 pt；image 为内嵌素材快照。 */
export interface CardLayerType {
  id: string
  kind: CardLayerKindEnum
  label: string
  /** 纸张左上角为原点，横纵坐标均为毫米 */
  x: number
  y: number
  width: number
  height: number
  text: string
  /** 图片内容以 data URL 保存，独立于素材库原图 */
  image: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  hidden: boolean
  /** 仅锁定画布拖动/缩放，仍可在设置面板修改 */
  locked: boolean
  /** 可选样式按旧模板默认值兼容；字距、描边、阴影单位为 pt。 */
  fontFamily?: string
  lineHeight?: number
  letterSpacing?: number
  strokeWidth?: number
  strokeColor?: string
  shadowColor?: string
  shadowBlur?: number
  shadowX?: number
  shadowY?: number
  singleLine?: boolean
  /** 奖状落款省略空行，ISO 日期用中文年月日展示，原始字段保持不变。 */
  textFormat?: 'award-signature'
  /** 素材文档中的节点与原始属性；未编辑时保留精确排版。 */
  scene?: { nodeId: string; base: Omit<CardLayerType, 'scene'> }
}

/** 通知风格的装饰素材随模板保存，离线复用不依赖素材库。 */
export interface CardFrameType {
  corner: string
  watermark: string
  color: string
}

/** 全局可复用模板，保存素材、布局、变量及公共内容，不保存学生数据。 */
export interface CardTemplateType {
  id: string
  name: string
  width: number
  height: number
  background: string
  /** contain 完整显示；cover 等比填满并裁切超出部分 */
  backgroundFit: 'contain' | 'cover'
  layers: CardLayerType[]
  /** 缺省时兼容原有白底模板；素材模板仍保留自己的场景边框。 */
  frame?: CardFrameType
  /** 用户显式保存的公共文案；班级、学期和日期始终按当前工作区生成。 */
  defaultFields?: Record<string, string>
  /** 转换得到的素材文档，与普通画布共用字段、图层和导出入口。 */
  scene?: PrintTemplateSceneType
}

/** 已渲染打印页面，width/height 为实际纸张毫米尺寸。 */
export interface PrintCanvasPageType {
  canvas: HTMLCanvasElement
  width: number
  height: number
}
