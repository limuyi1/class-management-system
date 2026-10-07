import router from './router'
import { createServerStatePlugin } from './repositories/v5StateRepository'
import VxeUIAll, { VxeUI } from 'vxe-pc-ui'
import VxeUITable from 'vxe-table'
import VxeUIPluginRenderElement from '@vxe-ui/plugin-render-element'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
/** 服务器入口不提前加载旧本地数据库和业务模块，避免混入旧账号缓存。 */
import './assets/style/main.css'
import './assets/style/element.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import ApiApp from './ApiApp.vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faFileCirclePlus,
  faQuoteLeft,
  faQuoteRight,
  faBookOpen,
  faCalculator,
  faLanguage,
  faFlask,
  faPersonRunning,
  faPalette,
  faMusic,
  faScaleBalanced,
  faStar,
  faPlus,
  faUserTag,
  faFileExport,
  faFileExcel,
  faCircleInfo,
  faDownload,
  faCheck,
  faMagnifyingGlass,
  faArrowPointer,
  faGripVertical,
  faUserPen,
  faEllipsis,
  faUserGroup
} from '@fortawesome/free-solid-svg-icons'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
library.add(faTrashCan)
library.add(
  faFileCirclePlus,
  faQuoteLeft,
  faQuoteRight,
  faBookOpen,
  faCalculator,
  faLanguage,
  faFlask,
  faPersonRunning,
  faPalette,
  faMusic,
  faScaleBalanced,
  faStar,
  faPlus,
  faUserTag,
  faFileExport,
  faFileExcel,
  faCircleInfo,
  faDownload,
  faCheck,
  faMagnifyingGlass,
  faArrowPointer,
  faGripVertical,
  faUserPen,
  faEllipsis,
  faUserGroup
)

if (import.meta.env.VITE_STORAGE_MODE === 'legacy') {
  void import('./legacyMain').catch((error) => console.error('加载旧版入口失败:', error))
} else {
  const app = createApp(ApiApp)
  app.component('font-awesome-icon', FontAwesomeIcon)
  const pinia = createPinia()
  pinia.use(createServerStatePlugin())
  app.use(pinia)
  app.use(router)
  VxeUI.use(VxeUIPluginRenderElement)
  app.use(VxeUIAll)
  app.use(VxeUITable)
  library.add(fas, far)
  app.use(ElementPlus, { locale: zhCn })
  app.mount('#app')
}
