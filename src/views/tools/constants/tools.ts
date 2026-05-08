export interface ToolItemType {
  id: string
  name: string
  icon: string
  path: string
  description: string
  status: 'available' | 'planned'
  openInNewTab?: boolean
}

export const toolItems: ToolItemType[] = [
  {
    id: 'name-list-compare',
    name: '名单核对',
    icon: 'list-check',
    path: '/tools/name-list-compare',
    description: '按基准名单生成对照视图，快速核对两份名单差异并复制或导出结果。',
    status: 'available'
  },
  {
    id: 'attachments',
    name: '附件库',
    icon: 'images',
    path: '/tools/attachments',
    description: '管理试卷图片素材，支持上传、裁剪、旋转和重命名。',
    status: 'available'
  },
  {
    id: 'paper-layout',
    name: '试卷排版',
    icon: 'file-pdf',
    path: '/tools/paper-layout',
    description: '上传多张试卷图片，按纸张规格排版并导出 PDF。',
    status: 'available'
  }
]
