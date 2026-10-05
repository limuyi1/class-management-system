/** 工具分类 ID 的取值 */
export type ToolCategoryIdType = 'feedback' | 'class-management' | 'documents'

/** 工具分类信息 */
export interface ToolCategoryType {
  id: ToolCategoryIdType
  name: string
  description: string
}

/** 工具项信息，用于工具中心列表展示与路由跳转 */
export interface ToolItemType {
  id: string
  name: string
  icon: string
  path: string
  description: string
  category: ToolCategoryIdType
  openInNewTab?: boolean
}

/** 工具中心的分组配置 */
export const toolCategories: ToolCategoryType[] = [
  {
    id: 'feedback',
    name: '教学反馈',
    description: '生成学生评语和成绩反馈'
  },
  {
    id: 'class-management',
    name: '班级管理',
    description: '核对学生信息并安排班级事务'
  },
  {
    id: 'documents',
    name: '文档与素材',
    description: '整理试卷和教学图片资源'
  }
]

/** 工具中心的全部工具项 */
export const toolItems: ToolItemType[] = [
  {
    id: 'roster-print',
    name: '名单打印',
    icon: 'print',
    path: '/tools/roster-print',
    description: '精简名册、收交、点名、成绩和签字表，自动分页导出 PDF。',
    category: 'class-management'
  },
  {
    id: 'batch-reports',
    name: '批量学习报告',
    icon: 'file-lines',
    path: '/tools/batch-reports',
    description: '统一成绩范围，批量生成学习报告并下载图片或合并 PDF。',
    category: 'feedback'
  },
  {
    id: 'exam-print',
    name: '考试分析打印稿',
    icon: 'chart-line',
    path: '/tools/exam-print',
    description: '打印本期测评统计、分数分布和学生明细。',
    category: 'feedback'
  },
  {
    id: 'comments',
    name: '评语处理',
    icon: 'comments',
    path: '/tools/comments',
    description: '使用系统学生或 Excel 临时数据，完成单个、批量评语生成与润色。',
    category: 'feedback'
  },
  {
    id: 'score-notice',
    name: '通知与奖状',
    icon: 'file-signature',
    path: '/tools/notice-awards',
    description: '制作成绩通知、奖状与表扬卡，上传素材并保存模板，逐人预览和批量导出。',
    category: 'feedback'
  },
  {
    id: 'seating-chart',
    name: '座位表',
    icon: 'chair',
    path: '/tools/seating-chart',
    description: '创建多套座位方案，支持手动拖拽安排、过道设置和随机排座。',
    category: 'class-management'
  },
  {
    id: 'duty-roster',
    name: '值日表',
    icon: 'broom',
    path: '/tools/duty-roster',
    description: '按天或按周安排清洁岗位，支持拖拽分工、值日组长和打印导出。',
    category: 'class-management'
  },
  {
    id: 'name-list-compare',
    name: '名单核对',
    icon: 'list-check',
    path: '/tools/name-list-compare',
    description: '按基准名单生成对照视图，快速核对两份名单差异并复制或导出结果。',
    category: 'class-management'
  },
  {
    id: 'paper-layout',
    name: '试卷排版',
    icon: 'file-pdf',
    path: '/tools/paper-layout',
    description: '上传多张试卷图片，按纸张规格排版并导出 PDF。',
    category: 'documents'
  },
  {
    id: 'attachments',
    name: '素材管理',
    icon: 'images',
    path: '/tools/attachments',
    description: '管理长期复用的图片素材，供试卷排版和后续错题本使用。',
    category: 'documents'
  }
]
