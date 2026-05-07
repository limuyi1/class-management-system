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

import { createPersistedStateDexie, preloadAllStores } from './plugins/persistDexie'
import { installFontAwesome } from './plugins/fontawesome'

import App from './App.vue'
import router from './router'

const app = createApp(App)

const pinia = createPinia()
pinia.use(createPersistedStateDexie())

installFontAwesome(app)

app.use(pinia)
app.use(ElementPlus, {
  locale: zhCn
})
app.use(VxeUIAll)
app.use(VxeUITable)
app.use(router)

app.mount('#app')

// 预加载所有 store（不阻塞渲染，提前完成持久化加载）
preloadAllStores()
