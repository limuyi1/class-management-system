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

library.add(fas, far)

import { createPersistedStateDexie } from './plugins/persistDexie'

import App from './App.vue'
import router from './router'

const app = createApp(App)

const pinia = createPinia()
pinia.use(createPersistedStateDexie())

app.component('font-awesome-icon', FontAwesomeIcon)

app.use(pinia)
app.use(ElementPlus, {
  locale: zhCn
})
app.use(VxeUIAll)
app.use(VxeUITable)
app.use(router)

app.mount('#app')
