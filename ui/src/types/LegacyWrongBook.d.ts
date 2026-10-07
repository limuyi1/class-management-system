/**
 * 仅供旧 Dexie 数据库与备份识别的历史类型；本版本不再提供错题本功能
 */

/**
 * 文件夹类型
 * 用于组织和管理错题题目
 */
export interface WrongFolder {
  /** 文件夹唯一标识 */
  id: string
  /** 文件夹名称 */
  name: string
  /** 父文件夹ID（用于嵌套文件夹） */
  parentId?: string
  /** 排序权重（数值越小越靠前） */
  order: number
  /** 创建时间（ISO 格式） */
  createdAt: string
}

/**
 * 文件夹树节点类型
 * 用于渲染文件夹树形结构
 */
export interface WrongFolderTree extends WrongFolder {
  /** 子文件夹列表 */
  children: WrongFolderTree[]
}

/**
 * 错题题目类型
 * 存储题目的完整信息
 */
export interface WrongQuestion {
  /** 题目唯一标识 */
  id: string
  /** 所属文件夹ID */
  folderId: string
  /** 原始文件夹ID（用于取消收藏时恢复原位置） */
  originalFolderId?: string
  /** 题目内容（Markdown 格式） */
  questionText: string
  /** 题目图片（Base64 编码） */
  questionImages: string[]
  /** 答案（Markdown 格式） */
  answer: string
  /** 解析（Markdown 格式，可选） */
  explanation?: string
  /** 题目类型 */
  questionType?: string
  /** 难度等级（1-5，1最简单，5最难） */
  difficulty?: number
  /** 是否收藏 */
  isFavorite: boolean
  /** 来源（可选） */
  source?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}
