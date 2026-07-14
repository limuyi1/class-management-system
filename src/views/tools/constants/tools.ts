export interface ToolItemType {
  id: string
  name: string
  icon: string
  path: string
  description: string
  status: 'available' | 'planned'
  tone?: 'primary' | 'secondary'
  openInNewTab?: boolean
}

export const toolItems: ToolItemType[] = [
  {
    id: 'comments',
    name: '评语处理',
    icon: 'comments',
    path: '/tools/comments',
    description: '使用系统学生或 Excel 临时数据，完成单个、批量评语生成与润色。',
    status: 'available'
  },
  {
    id: 'seating-chart',
    name: '座位表',
    icon: 'chair',
    path: '/tools/seating-chart',
    description: '创建多套座位方案，支持手动拖拽安排、过道设置和随机排座。',
    status: 'available'
  },
  {
    id: 'score-notice',
    name: '成绩通知',
    icon: 'file-signature',
    path: '/tools/score-notice',
    description: '导入考试等级或分数，生成可编辑、可复制和批量导出的学生成绩报告。',
    status: 'available'
  },
  {
    id: 'name-list-compare',
    name: '名单核对',
    icon: 'list-check',
    path: '/tools/name-list-compare',
    description: '按基准名单生成对照视图，快速核对两份名单差异并复制或导出结果。',
    status: 'available'
  },
  {
    id: 'paper-layout',
    name: '试卷排版',
    icon: 'file-pdf',
    path: '/tools/paper-layout',
    description: '上传多张试卷图片，按纸张规格排版并导出 PDF。',
    status: 'available'
  },
  {
    id: 'attachments',
    name: '素材管理',
    icon: 'images',
    path: '/tools/attachments',
    description: '管理长期复用的图片素材，供试卷排版和后续错题本使用。',
    status: 'available',
    tone: 'secondary'
  }
]
