/**
 * 应用入口文件
 * 注册 Pinia、Vue Router、Element Plus、FontAwesome 等全局插件
 */
import './assets/style/main.css'
import './assets/style/element.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import VxeUIAll, { VxeUI } from 'vxe-pc-ui'
import VxeUITable from 'vxe-table'
import VxeUIPluginRenderElement from '@vxe-ui/plugin-render-element'
VxeUI.use(VxeUIPluginRenderElement)

import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'

// 注册 FontAwesome 实心与常规两套图标集
library.add(fas, far)

import { createPersistedStateDexie, preloadAllStores } from './plugins/persistDexie'

import App from './App.vue'
import router from './router'

const app = createApp(App)

const pinia = createPinia()
// 接入 Dexie 持久化插件，Pinia 状态变更时自动写入 IndexedDB
pinia.use(createPersistedStateDexie())

// 全局注册 FontAwesome 图标组件
app.component('font-awesome-icon', FontAwesomeIcon)

app.use(pinia)
// 使用 Element Plus 并设置中文语言包
app.use(ElementPlus, {
  locale: zhCn
})
// 注册 VxeTable 表格组件库及其渲染插件
app.use(VxeUIAll)
app.use(VxeUITable)
app.use(router)

// 挂载根组件
app.mount('#app')

// 预加载所有 store（不阻塞渲染，提前完成持久化加载）
preloadAllStores()
