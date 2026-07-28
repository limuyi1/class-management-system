/** 通用树节点，用于错题本文件夹等树形结构 */
export interface TreeNode {
  /** 节点唯一标识 */
  id: string
  /** 节点名称 */
  name: string
  /** 父节点 ID（根节点无此字段） */
  parentId?: string
  /** 同级排序权重（数值越小越靠前） */
  order: number
  /** 创建时间（ISO 格式） */
  createdAt: string
  /** 子节点列表 */
  children?: TreeNode[]
}
