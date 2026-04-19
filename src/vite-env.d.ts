/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare module '*.svg'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.gif'
declare module '*.bmp'
declare module '*.tiff'

declare module 'element-plus/dist/locale/zh-cn.mjs'
declare module 'dom-to-image'
declare module 'vue-cropper'

declare namespace JSX {
  interface IntrinsicElements {
    'font-awesome-icon': unknown
  }
}
