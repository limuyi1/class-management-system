/**
 * 设置数据迁移工具
 * 用于版本升级时的旧数据格式兼容和标准化转换
 */
import type { SettingType } from '@/types/Setting'

/** 旧版成绩列结构：disabled 字段可能缺失 */
type LegacySettingType = Omit<SettingType, 'disabled'> & {
  disabled?: boolean
}

/**
 * 将旧版成绩列结构补齐为当前结构。
 * 旧数据没有 disabled 字段时，一律按启用处理。
 * @param scoreColumns - 旧版成绩列数组
 * @returns 补齐 disabled 字段后的成绩列数组
 */
export const normalizeScoreColumns = (scoreColumns: LegacySettingType[]): SettingType[] => {
  return scoreColumns.map((item) => ({
    ...item,
    disabled: item.disabled ?? false
  }))
}
