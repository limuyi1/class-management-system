/** 表格列、标签分类与标签数据等设置相关类型定义 */

/** 表格列配置项，用于成绩表头、评语表头等动态列的元信息 */
export interface SettingType {
  /** 列的数据字段名（prop），对应 StudentDataType 中的动态键 */
  prop: string
  /** 列的显示名称（表头文本） */
  label: string
  /** 是否禁用该列（禁用后不在视图中展示） */
  disabled: boolean
}

/** 学生标签分类 */
export interface TagCategoryType {
  /** 分类标识（prop），如 'xue2_xi2_xi2_guan4' */
  prop: string
  /** 分类显示名称，如 '学习习惯' */
  label: string
}

/** 标签数据集合，以分类 prop 为 key，value 为该分类下的标签列表 */
export interface TagType {
  [category: string]: Array<string>
}
