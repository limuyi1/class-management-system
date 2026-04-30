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
  },
  {
    id: 'teacher-schedule',
    name: '教师排课',
    icon: 'calendar-days',
    path: '/teacher-schedule',
    description: '先录班级、课程、教师和历史记录，再生成排课草案并做人工微调。',
    status: 'available',
    openInNewTab: true
  }
]
