/**
 * 数据库导入状态标记。
 * 持久化订阅在导入期间需要暂停写回，避免导入过程触发多余的数据落库。
 */
let databaseImporting = false

/** 设置数据库导入状态 */
export const setDatabaseImporting = (value: boolean) => {
  databaseImporting = value
}

/** 是否正在执行数据库导入 */
export const isDatabaseImporting = () => databaseImporting
