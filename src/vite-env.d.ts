/// <reference types="vite/client" />

// 声明 .vue 单文件组件模块，使 TypeScript 能识别 vue 文件的导入
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

// 声明常见静态资源模块，导入图片资源时可通过类型检查
declare module '*.svg'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.gif'
declare module '*.bmp'
declare module '*.tiff'

// 声明缺少内置类型定义的第三方模块
declare module 'element-plus/dist/locale/zh-cn.mjs'
declare module 'dom-to-image'
declare module 'vue-cropper'

// 为 JSX/TSX 声明全局可用的自定义组件
declare namespace JSX {
  interface IntrinsicElements {
    'font-awesome-icon': unknown
  }
}
