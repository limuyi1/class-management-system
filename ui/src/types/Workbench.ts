/** 共用侧栏菜单项，由各工作台提供导航目标与可用性。 */
export interface WorkbenchMenuItemType {
  key: string
  label: string
  icon: string
  disabled?: boolean
  title?: string
}
