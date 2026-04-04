export interface TreeNode {
  id: string
  name: string
  parentId?: string
  order: number
  createdAt: string
  children?: TreeNode[]
}
