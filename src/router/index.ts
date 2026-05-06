import { createRouter, createWebHashHistory } from 'vue-router'

import OverviewPage from '@/views/overview/OverviewPage.vue'
import MainPage from '@/views/main/MainPage.vue'
import RootRedirectPage from '@/views/root/RootRedirectPage.vue'
import Math from '@/views/score/ScorePage.vue'
import Comment from '@/views/evaluation/EvaluationPage.vue'
import Setting from '@/views/setting/SettingPage.vue'
import WrongBook from '@/views/wrong-book/WrongBookPage.vue'
import Tools from '@/views/tools/ToolsPage.vue'
import AttachmentLibraryPage from '@/views/tools/AttachmentLibraryPage.vue'
import PaperLayoutPage from '@/views/tools/PaperLayoutPage.vue'

import { useDataSourceStore } from '@/stores/data-source'
import type { NavigationGuardWithThis, RouteLocationNormalized } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'RootRedirect',
      component: RootRedirectPage
    },
    {
      path: '/main',
      name: 'Main',
      component: MainPage,
      children: [
        {
          path: '/overview',
          name: 'Overview',
          component: OverviewPage
        },
        {
          path: '/math',
          name: 'Math',
          component: Math
        },
        {
          path: '/comment',
          name: 'Comment',
          component: Comment
        },
        {
          path: '/wrong-book',
          name: 'WrongBook',
          component: WrongBook
        },
        {
          path: '/tools',
          name: 'Tools',
          component: Tools
        },
        {
          path: '/tools/attachments',
          name: 'AttachmentLibrary',
          component: AttachmentLibraryPage
        },
        {
          path: '/tools/paper-layout',
          name: 'PaperLayout',
          component: PaperLayoutPage
        },
        {
          path: '/setting',
          name: 'Setting',
          component: Setting
        }
      ]
    }
  ]
})

export function createDataGuard(
  getStore: () => Pick<ReturnType<typeof useDataSourceStore>, 'waitForInitReady' | 'enabledData'> =
    useDataSourceStore
): NavigationGuardWithThis<undefined> {
  return async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: (to?: string | false | void) => void
  ) => {
    const allowedPaths = [
      '/tools',
      '/tools/attachments',
      '/tools/paper-layout',
      '/setting'
    ]

    if (allowedPaths.includes(to.path)) {
      next()
      return
    }

    const store = getStore()
    await store.waitForInitReady()

    if (store.enabledData.length === 0) {
      next('/tools')
      return
    }

    next()
  }
}

router.beforeEach(createDataGuard())

export default router
