export interface SettingType {
  prop: string
  label: string
}

export interface TagCategoryType {
  prop: string
  label: string
}

export interface TagType {
  [category: string]: Array<string>
}
