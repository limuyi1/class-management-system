/** 可编辑的通用文档树；只保存受限标签、样式与素材，不保存学生数据或可执行脚本。 */
export interface PrintTemplateNodeType {
  tag: string
  attributes: Record<string, string>
  children: PrintTemplateNodeType[]
  text?: string
  id?: string
}

/** 素材按内容去重，重复花纹和字体只保存一份。 */
export interface PrintTemplateSceneType {
  version: 1
  root: PrintTemplateNodeType
  assets: Record<string, string>
  pixelWidth: number
  pixelHeight: number
}
