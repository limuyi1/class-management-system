/// <reference types="vite/client" />
// 环境变量类型声明：新增 VITE_ 前缀环境变量时在此补充字段类型
interface ImportMetaEnv {}

// 为 import.meta.env 提供类型支持
interface ImportMeta {
  readonly env: ImportMetaEnv
}
